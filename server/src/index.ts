import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import pgSession from 'connect-pg-simple';
import axios from 'axios';
import cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import path from 'path';

import { find, isEqual, sortBy, differenceWith } from 'lodash';

dotenv.config();

const prisma = new PrismaClient();

export interface SearchResult {
    url: string;
    keywords: { keyword: string, context: string }[];
}

export interface SearchResutChange {
    date: number;
    changes: SearchResult[];
}

export interface User {
    id: string;
    email: string;
    urls: string[];
    keywords: string[];
    sendEmail: boolean;
    status: 'ACTIVE' | 'INACTIVE';
}

const schema = buildSchema(`
  enum Status {
    ACTIVE
    INACTIVE
  }

  type User {
    id: String! 
    email: String!
    urls: [String]
    keywords: [String]
    status: Status
    sendEmail: Boolean
  }

  type KeywordResult {
    keyword: String
    context: String
  }

  type SearchResult {
    url: String!
    keywords: [KeywordResult]
  }

  type SearchResultChange {
      date: Float
      changes: [SearchResult]
  }

  input UserInput {
    id: String
    email: String
    urls: [String]
    keywords: [String]
    status: Status
    sendEmail: Boolean
  }

  type Query {
    user: User
    users: [User]
    search(urls: [String], keywords: [String]): [SearchResult]
    refreshSearchResultChanges: [SearchResultChange]
    clearSearchResultChanges: [Int]
    searchResultChanges: [SearchResultChange]
  }

  type Mutation {
    updateUser(user: UserInput): User
  }
`);

const previousSearchResults = new Map<string, SearchResult[]>();
const searchResultChanges = new Map<string, Array<{ date: Date, changes: SearchResult[] }>>();

const searchForKeywordsInUrls = async (urls: string[], keywords: string[]): Promise<SearchResult[]> => {
    keywords = keywords.map(keyword => keyword.toLowerCase());

    const searchResults = [] as SearchResult[];

    for (const url of urls) {
        const searchResult = { url, keywords: [] } as SearchResult;

        let text: string;

        try {
            const response = await axios.get(url);
            const $ = cheerio.load(response.data, { decodeEntities: true });
            text = cheerio.text($('body')).toLowerCase().replace(/\s\s+/g, ' ');
        } catch (e) {
            continue;
        }

        keywords.forEach(keyword => {
            const matches = text.matchAll(new RegExp(keyword, 'g'));
            for (const match of matches) {
                const index = match.index as number;
                searchResult.keywords.push({ keyword: keyword, context: text.substr(Math.max(0, index - 50), 100) });
            }
        });

        if (searchResult.keywords.length > 0) {
            searchResults.push(searchResult);
        }
    }

    return searchResults;
};

const getSearchResultChange = (currentResults: SearchResult[], previousResults: SearchResult[]) => {
    const searchResultChange = [] as SearchResult[];
    for (const currentResult of currentResults) {
        const previousResult = previousResults.find((savedResult) => savedResult.url === currentResult.url);

        if (!previousResult) {
            searchResultChange.push({ ...currentResult });
            continue;
        }

        const newKeywords = differenceWith(currentResult.keywords, previousResult.keywords, isEqual);

        if (newKeywords.length > 0) {
            searchResultChange.push({ url: currentResult.url, keywords: newKeywords });
        }
    }
    return searchResultChange;
};

const updateSearchResultChange = async (user: User) => {
    if (!searchResultChanges.get(user.id)) {
        searchResultChanges.set(user.id, []);
    }
    if (!previousSearchResults.get(user.id)) {
        previousSearchResults.set(user.id, []);
    }

    const currentSearchResult = await searchForKeywordsInUrls(user.urls, user.keywords);
    const previousSearchResult = previousSearchResults.get(user.id);

    const searchResultDiff = getSearchResultChange(currentSearchResult, previousSearchResult!);

    if (searchResultDiff.length > 0) {
        searchResultChanges.get(user.id)!.push({ date: new Date(), changes: searchResultDiff });
        previousSearchResults.set(user.id, currentSearchResult);
    }

    return searchResultDiff;
};



const sendMail = async (to: string, changes: SearchResult[]) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const text = changes.reduce((acc, change) => `${acc} + ${change.url}: ${change.keywords.reduce((acc, keyword) => `${acc}, ${keyword.keyword}`, '')}\n`, '');

    const mailOptions = {
        from: process.env.EMAIL,
        to,
        subject: 'New keyword appeared',
        text
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (e) {
        console.log(e);
    }
};

let emailTimer: any;

const watchForearchResultChanges = () => {
    emailTimer = setInterval(async () => {
        const users = (await prisma.user.findMany()) as User[];
        for (const user of users) {
            const changes = await updateSearchResultChange(user);
            if (user.sendEmail && changes?.length > 0) {
                sendMail(user.email, changes);
            }
        }
    }, Number(process.env.SEARCH_FREQUENCY));
};


const root = {
    user: async (data: any, req: Request) => {
        return req.user;
    },

    users: async () => {
        return await prisma.user.findMany();
    },

    updateUser: async ({ user }: { user: User }, req: Request) => {
        let id = (req.user as any)?.id;
        if (user.email) {
            id = (await prisma.user.findFirst({ where: { email: user.email } }))?.id;
        }
        return req.user = await prisma.user.update({ data: user, where: { id } });
    },

    search: async ({ urls, keywords }: any, req: Request) => {
        const user = req.user as User;
        if (!urls) {
            urls = user.urls;
        }
        if (!keywords) {
            keywords = user.keywords;
        }
        return searchForKeywordsInUrls(urls, keywords);
    },

    searchResultChanges: async (args: any, req: Request) => {
        const user = req.user as User;
        return searchResultChanges.get(user.id);
    },

    refreshSearchResultChanges: async (args: any, req: Request) => {
        await updateSearchResultChange(req.user as any);
        return searchResultChanges.get((req.user as any).id);
    },

    clearSearchResultChanges: async (args: any, req: Request) => {
        searchResultChanges.set((req.user as any).id, []);
        return [];
    }
};

const app = express();
const port = process.env.PORT;

app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));

app.use(
    session({
        store: new (pgSession(session))({ conString: process.env.DATABASE_URL }),
        secret: process.env.SESSION_SECRET as string,
        saveUninitialized: false,
        resave: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, (user as User).id);
});

passport.deserializeUser(async (userid: string, done) => {
    const user = await prisma.user.findFirst({ where: { id: userid } });
    done(null, user);
});


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    callbackURL: process.env.CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    let user = await prisma.user.findFirst({ where: { id: profile.id } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                id: profile.id,
                email: profile.emails![0].value,
            }
        });
    }
    return done(null as any, user);
}));

app.get('/user/logged', (req, res) => {
    res.send(req.user ? true : false);
});

app.get('/auth/fail', (req, res) => {
    res.sendStatus(401);
});

const checkUserLoggedIn = (req: Request, res: Response, next: NextFunction) => {
    req.user ? next() : res.sendStatus(401);
};

//Protected Routes.
app.use('/graphql', checkUserLoggedIn, graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));

app.get('/auth/success', checkUserLoggedIn, (req, res) => {
    res.redirect(process.env.LOGIN_SUCCESS_REDIREC_URL as string);
});

// Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/fail', successRedirect: '/auth/success' }));

//Logout
app.get('/logout', (req, res) => {
    req.session.destroy(data => data);
    req.logout();
    res.send(`<h1>logged out successfully<h1>`);
});

app.use(express.static(path.join(__dirname, '../../client/build')));

app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
});

const server = app.listen(port, () => {
    console.log(`Keyword search app listening at http://localhost:${port}`);
    watchForearchResultChanges();
});

process.on('SIGTERM', () => {
    console.log('closing the server');
    clearInterval(emailTimer);
    server.close();
});
