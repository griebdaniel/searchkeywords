import axios from 'axios';
import { sortBy } from 'lodash';
import { textChangeRangeIsUnchanged } from 'typescript';

const serverUrl = process.env.REACT_APP_SERVER_URL;
const config = { withCredentials: true };

export interface User {
    id: string;
    email: string;
    keywords: string[];
    urls: string[];
    status: 'ACTIVE' | 'INACTIVE';
    sendEmail: boolean;
}

export interface SearchResult {
    url: string;
    keywords: {
        keyword: string;
        context: string;
    }[];
}

export interface SearchResultChange {
    date: number;
    changes: SearchResult[]
}

class GenericService {
    private loggedInUser: User | null = null;

    async login() {
        window.location.href = serverUrl + '/auth/google';
    }

    async logout() {
        await axios.get(serverUrl + '/logout', config);
    }

    async getLoggedInUser() {
        if (this.loggedInUser) {
            return this.loggedInUser;
        }
        return this.loggedInUser = await this.getUser();
    }

    async getUser(): Promise<User | null> {
        let res;
        const query = `
        query {
            user {
                id
                urls
                keywords
                status
                sendEmail
            }
          }`;
        try {
            res = await axios.post(serverUrl + '/graphql', { query }, config);
        } catch (e) {
            return null;
        }
        return res.data.data.user;
    }

    async updateUser(user: Partial<User>): Promise<boolean> {
        const query = `
            mutation UpdateUser($user: UserInput) {
                updateUser(user: $user) {
                id
                urls
                keywords
                status
                sendEmail
                }
            }`;

        const res = await axios.post(serverUrl + '/graphql', { query, variables: { user } }, config);
        return res.data.data;
    }

    async search(variables: any): Promise<SearchResult[]> {
        const query = `
        query Search($urls: [String], $keywords: [String]) {
            search(urls: $urls, keywords: $keywords) {
              url 
                keywords {
              keyword
              context
            }
          }  
        }`;
        const res = await axios.post(serverUrl + '/graphql', { query, variables }, config);
        return res.data.data.search;
    }

    async refreshSearchResultChanges(): Promise<SearchResultChange[]> {
        const query = `
        {
            refreshSearchResultChanges {
              date
              changes {
                url
                keywords {
                  keyword
                  context
                }
              }
            }
          }
        `;

        const changes = (await axios.post(serverUrl + '/graphql', { query }, config)).data.data.refreshSearchResultChanges as SearchResultChange[];
        return changes?.reverse();
    }

    async getSearchResultChanges(): Promise<SearchResultChange[]> {
        const query = `
        {
            searchResultChanges {
                date
                changes {
                    url
                    keywords {
                        keyword
                        context
                    }
                }
            }
        }`;
        const changes = (await axios.post(serverUrl + '/graphql', { query }, config)).data.data.searchResultChanges as SearchResultChange[];
        return changes?.reverse();
    }


    async clearSearchResultChanges(): Promise<any[]> {
        const query = `{
            clearSearchResultChanges
        }`;

        const res = await axios.post(serverUrl + '/graphql', { query }, config);
        return res.data.data.clearSearchResultChanges;
    }
}

export const genericService = new GenericService();