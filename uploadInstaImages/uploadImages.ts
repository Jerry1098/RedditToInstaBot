import { IgApiClient } from "instagram-private-api";
import { readFile, writeFile, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import { Client } from 'pg';

let ref, urlSegmentToInstagramId, instagramIdToUrlSegment;
ref = require('instagram-id-to-url-segment');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

instagramIdToUrlSegment = ref.instagramIdToUrlSegment;
urlSegmentToInstagramId = ref.urlSegmentToInstagramId;

const db = new Client({
    user: 'postgresUser',
    host: 'localhost',
    database: 'redditToInstaBot',
    password: '6969696966969696696966969696',
    port: 5532,
});

const ig = new IgApiClient();

const username = "galaxy_smg950f";
const password = "Jeremias00";

const sessionPath = './data';
const sessionFilename = '/session.json'

async function saveSession(data: object) {
    if (!existsSync(sessionPath)) {
        mkdirSync(sessionPath);
    }
    await writeFileAsync(sessionPath + sessionFilename, JSON.stringify(data));
}

async function sessionExists() {
    return existsSync(sessionPath + sessionFilename);
}

async function sessionLoad() {
    return await readFileAsync(sessionPath + sessionFilename);
}

async function login() {
    ig.state.generateDevice(username);
    ig.request.end$.subscribe(async () => {
        const serialized = await ig.state.serialize();
        delete serialized.constants;
        await saveSession(serialized);
    });
    if (await sessionExists()) {
        await ig.state.deserialize(await sessionLoad());
    }
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    process.nextTick(async () => await ig.simulate.postLoginFlow())
}

async function uploadPhoto(filepath: string, caption: string) {
    return await ig.publish.photo({
        file: await readFileAsync(filepath),
        caption: caption,
    });
}

async function commentPhoto(mediaID: string, text: string) {
    return await ig.media.comment({mediaId: mediaID, text: text});
}

async function uploadAndCommentPhoto(filepath: string, caption: string, comment: string) {
    try {
        const resUpload = await uploadPhoto(filepath, caption);
        const resComment = await commentPhoto(resUpload.media.pk, comment);
        return [resComment, resUpload];
    } catch (e) {
        console.log(e.stack);
        return null;
    }
}

function sleep(sec: number) {
    const ms = sec * 1000;
    return new Promise( resolve => setTimeout(resolve, ms));
}

async function getToUploadItem() {
    const query = 'SELECT * FROM public.to_upload FETCH FIRST ROW ONLY';
    try {
        const res = await db.query(query);
        return res.rows[0];
    } catch (e) {
        console.log(e.stack);
        return null;
    }
}

async function deleteToUploadItem(reddit_id: string) {
    const query = `DELETE FROM public.to_upload WHERE reddit_id='${reddit_id}'`;
    try {
        const res = await db.query(query);
        return res;
    } catch (e) {
        console.log(e.stack);
    }
}

async function insertPostInPosts(reddit_id: string, instagram_id: string, instagram_pk: string) {
    const query = `INSERT INTO public.posts (reddit_id, instagram_id, instagram_pk) 
                    VALUES ('${reddit_id}', '${instagram_id}', '${instagram_pk}')`;
    try {
        const res = await db.query(query);
        return res;
    } catch (e) {
        console.log(e.stack);
    }
}

(async () =>{
    db.connect();
    await login();
    db.end();
})();