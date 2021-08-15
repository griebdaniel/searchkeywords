import { TextField, Button, Chip, createStyles, makeStyles, Theme, Link, List, ListItem, ListItemText, Tooltip, Divider, AppBar, IconButton, Toolbar, Typography, CircularProgress, Snackbar, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid, Checkbox, FormControlLabel, Avatar, Dialog, DialogTitle, ListItemAvatar } from '@material-ui/core';
import { Fragment, useMemo, useRef, useState } from 'react';
import { uniq, without, isEqual, sortBy, difference } from 'lodash';
import { useEffect } from 'react';

import { genericService, SearchResult, SearchResultChange } from '../services/GenericService';
import { Clear, ClearAll, Help, Refresh, Settings } from '@material-ui/icons';
import { DateTime } from 'luxon';
import axios from 'axios';

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            display: 'inline-flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            listStyle: 'none',
            padding: theme.spacing(0.5),
            margin: 0,
        },
        chip: {
            margin: theme.spacing(0.5),
        },
        help: {
            color: theme.palette.info.light
        },
        settings: {
            color: theme.palette.grey[400]
        }
    }),
);

export interface Preferences {
    sendEmail: boolean;
}

export interface PreferencesDialogProps {
    open: boolean;
    settings: Preferences;
    onClose: (value: Preferences) => void;
}


function SearchKeywords(props: any) {
    const classes = useStyles();

    const [url, setUrl] = useState('');
    const [keyword, setKeyword] = useState('');

    const [urls, setUrls] = useState<string[]>([]);
    const [keywords, setKeywords] = useState<string[]>([]);

    const [searchResult, setSearchResult] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    const [displayNoResults, setDisplayNoResults] = useState(false);
    const [disableSearchButton, setDisableSearchButton] = useState(false);

    const [disableSaveButton, setDisableSaveButton] = useState(true);
    const [saveSuccessMessageOpen, setSaveSuccessMessageOpen] = useState(false);

    const [serachResultChanges, setSearchResultChanges] = useState<SearchResultChange[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const [sendEmail, setSendEmail] = useState(false);
    const [invalidUrl, setInvalidUrl] = useState(false);

    const [openPreferenfces, setOpenPreferences] = useState(false);

    let saved = useRef<{ urls: string[], keywords: string[] }>({ urls: [], keywords: [] });

    // useMemo(() => {
    //     saved = {} as any;
    // }, []);

    useEffect(() => {
        genericService.getLoggedInUser().then(user => {
            saved.current = { urls: [...(user?.urls as any)], keywords: [...(user?.keywords as any)] };
            setUrls(user?.urls as any);
            setKeywords(user?.keywords as any);
            setSendEmail(user?.sendEmail as any);
        });
        genericService.getSearchResultChanges().then(changes => {
            setSearchResultChanges(changes ?? []);
        });
    }, []);

    useEffect(() => {
        setDisableSearchButton(urls.length === 0 || keywords.length === 0);

        if (
            !isEqual(sortBy(urls), sortBy(saved.current.urls)) ||
            !isEqual(sortBy(keywords), sortBy(saved.current.keywords))
        ) {
            setDisableSaveButton(false);
        } else {
            setDisableSaveButton(true);
        }
    }, [urls, keywords]);

    const addUrl = async () => {
        try {
            if (!url) {
                return;
            }
            new URL(url);
            setInvalidUrl(false);
        } catch (e) {
            setInvalidUrl(true);
            return;
        }

        setUrls(uniq([...urls, url]));
        setUrl('');
    };

    const addKeyword = () => {
        setKeywords(uniq([...keywords, keyword]));
        setKeyword('');
    };

    const deleteUrl = (url: string) => {
        setUrls(without(urls, url));
    };

    const deleteKeyword = (keyword: string) => {
        setKeywords(without(keywords, keyword));
    };

    const searchUrls = async () => {
        setSearching(true);
        setDisplayNoResults(false);
        setSearchResult([]);
        const buttonState = disableSearchButton;
        setDisableSearchButton(true);
        const searchResult = await genericService.search({ urls, keywords });
        setDisableSearchButton(buttonState);
        setSearching(false);
        setDisplayNoResults(searchResult.length === 0);
        setSearchResult(searchResult);
    };

    const save = async () => {
        try {
            await genericService.updateUser({ urls, keywords });
            saved.current = { urls: [...urls], keywords: [...keywords] };
            setSaveSuccessMessageOpen(true);
        } catch (e) {

        }
    };

    const refreshTable = async () => {
        setRefreshing(true);
        const changes = await genericService.refreshSearchResultChanges();
        setSearchResultChanges(changes);
        setRefreshing(false);
    };

    const clearTable = async () => {
        genericService.clearSearchResultChanges();
        setSearchResultChanges([]);
    };


    const handleSendEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSendEmail(event.target.checked);
    };

    const savePreferences = async () => {
        try {
            await genericService.updateUser({ sendEmail });
            setSaveSuccessMessageOpen(true);
        } catch (e) {

        }
        setOpenPreferences(false);
    };

    return (
        <div>
            <Snackbar
                open={saveSuccessMessageOpen}
                autoHideDuration={2000}
                onClose={() => setSaveSuccessMessageOpen(false)}
                message="Saved successfully"
            />
            <AppBar position="static">
                <Toolbar style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Tooltip title=
                        {
                            <List>
                                <ListItem>
                                    <ListItemText>
                                        You can add/remove an url/keyword using the inputs and the ADD button.
                                    </ListItemText>
                                </ListItem>
                                <ListItem>
                                    <ListItemText>
                                        Clicking search will search each website for each keyword.
                                    </ListItemText>
                                </ListItem>
                                <ListItem>
                                    <ListItemText>
                                        Hovering a keyword in the search result shows you the context in which the keyword appears.
                                    </ListItemText>
                                </ListItem>
                            </List>
                        }
                    >
                        <Help className={classes.help} />
                    </Tooltip>
                    <IconButton  className={classes.settings} onClick={() => setOpenPreferences(true)} aria-label="settings">
                        <Settings />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Dialog open={openPreferenfces} onClose={() => setOpenPreferences(false)}>
                <DialogTitle id="simple-dialog-title">Preferences</DialogTitle>
                <FormControlLabel
                    style={{ margin: 10 }}
                    control={
                        <Checkbox
                            checked={sendEmail}
                            onChange={handleSendEmailChange}
                            name="checkedB"
                            color="primary"
                        />
                    }
                    label="Send me email if keyword appears."
                />
                <Button style={{ margin: '10px 20px' }} variant="contained" color="primary" onClick={() => savePreferences()}> Save </Button>
            </Dialog>
            <div style={{ display: 'grid', width: '100%', gridTemplateColumns: '1fr 0 2fr', columnGap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', margin: 40 }}>
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: 500 }}>
                            <TextField error={invalidUrl} helperText={invalidUrl ? 'Invalid url.' : ''} placeholder="Add a new URL like 'https://google.com'" style={{ marginRight: '20px', width: '100%' }} value={url} onChange={event => setUrl(event.target.value)}></TextField>
                            <Button variant="outlined" onClick={addUrl} color="primary">Add</Button>
                        </div>
                        <div>
                            <div className={classes.root}>
                                {urls.map((url, index) => {
                                    return (
                                        <Chip
                                            key={index}
                                            size="small"
                                            label={url}
                                            onDelete={() => deleteUrl(url)}
                                            className={classes.chip}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: 40 }}>
                        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: 500 }}>
                            <TextField placeholder="Add a new KEYWORD like 'Jehova', 'Witness', 'jw.org'" style={{ marginRight: '20px', width: '100%' }} value={keyword} onChange={event => setKeyword(event.target.value)}></TextField>
                            <Button variant="outlined" onClick={addKeyword} color="primary">Add</Button>
                        </div>
                        <div>
                            <div className={classes.root}>
                                {keywords.map((keyword, index) => {
                                    return (
                                        <Chip
                                            key={index}
                                            size="small"
                                            label={keyword}
                                            onDelete={() => deleteKeyword(keyword)}
                                            className={classes.chip}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', margin: '50px 0px 10px' }} >
                        <Tooltip
                            title={disableSearchButton && !searching ? 'You must specify at least one keyword or url.' : ''}
                        >
                            <span>
                                <Button style={{ width: 200, marginRight: 20 }} disabled={disableSearchButton} variant="contained" onClick={searchUrls} color="primary">Search</Button>
                            </span>
                        </Tooltip>

                        <Tooltip
                            title={disableSaveButton ? 'The current values are already saved.' : ''}
                        >
                            <span>
                                <Button style={{ width: 200 }} variant="contained" disabled={disableSaveButton} onClick={save} color="primary">Save</Button>
                            </span>
                        </Tooltip>

                    </div>
                    <Divider style={{ marginTop: 20 }} />
                    <List>
                        {searching && <CircularProgress color="secondary" />}
                        {displayNoResults && <Typography>No results found</Typography>}
                        {searchResult.map(((searchResult, index) => (
                            <ListItem key={index}>
                                <ListItemText
                                    key={index}
                                    primary={<Link href={searchResult.url}>{searchResult.url}</Link>}
                                    secondary={
                                        <div className={classes.root}>
                                            {searchResult.keywords.map((keyword, index) => {
                                                return (
                                                    <Tooltip key={index} title={keyword.context}>
                                                        <Chip size="small" label={keyword.keyword} className={classes.chip} />
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    }
                                >
                                </ListItemText>
                            </ListItem>
                        )))}
                    </List>
                </div>
                <Divider orientation="vertical" />
                <Paper variant="outlined" style={{ height: 'fit-content', margin: 20 }}>
                    <Toolbar>
                        <Typography style={{ flex: '1 1 100%' }} variant="h6" id="tableTitle" component="div">
                            Keyword Appearances
                        </Typography>
                        <Tooltip title="Clear all content">
                            <IconButton onClick={clearTable} aria-label="clear">
                                <Clear />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Refresh content">
                            <IconButton disabled={refreshing} onClick={refreshTable} aria-label="filter list">
                                <Refresh />
                            </IconButton>
                        </Tooltip>
                    </Toolbar>
                    {refreshing && <CircularProgress size={30} style={{ marginLeft: 20 }} color="secondary" />}
                    <TableContainer>
                        <Table caria-label="simple table">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Datetime</TableCell>
                                    <TableCell>Web Page</TableCell>
                                    <TableCell>Keywords</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {serachResultChanges.map((searchResultChange, index) => (
                                    <Fragment key={index}>
                                        <TableRow>
                                            <TableCell rowSpan={searchResultChange.changes.length + 1}>
                                                {DateTime.fromMillis(searchResultChange.date).toFormat('LLL dd HH:mm')}
                                            </TableCell>
                                        </TableRow>
                                        {searchResultChange.changes.map((change, index) => (
                                            <TableRow key={index}>
                                                <TableCell><Link href={change.url}>{change.url}</Link>{ }</TableCell>
                                                <TableCell>
                                                    {change.keywords.map((keyword, index) => {
                                                        return (
                                                            <Tooltip key={index} title={keyword.context}>
                                                                <Chip size="small" label={keyword.keyword} className={classes.chip} />
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </TableCell>
                                            </TableRow>

                                        ))}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </div>

        </div>

    );
}

export default SearchKeywords;
