import { IgApiClient, IgLoginRequiredError } from "instagram-private-api";
import { existsSync, mkdirSync, readFile, unlink, writeFile } from "fs";
import { promisify } from "util";
import { Client } from "pg";

let ref, urlSegmentToInstagramId, instagramIdToUrlSegment;
ref = require("instagram-id-to-url-segment");

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlink);

instagramIdToUrlSegment = ref.instagramIdToUrlSegment;
urlSegmentToInstagramId = ref.urlSegmentToInstagramId;

const db = new Client({
  user: "postgresUser",
  host: "localhost",
  database: "redditToInstaBot",
  password: "6969696966969696696966969696",
  port: 5532,
});

const ig = new IgApiClient();
let currentInstaUser = null;

const username = "galaxy_smg950f";
const password = "Jeremias00";

const sessionPath = "./data";
const sessionFilename = "/session.json";

async function saveSession(data: object) {
  if (!existsSync(sessionPath)) {
    mkdirSync(sessionPath);
  }
  await writeFileAsync(
    sessionPath + sessionFilename,
    JSON.stringify(data),
    "utf8"
  );
}

async function sessionExists() {
  return existsSync(sessionPath + sessionFilename);
}

async function sessionLoad() {
  let toReturn = await readFileAsync(sessionPath + sessionFilename, "utf8");
  console.log(toReturn);
  toReturn = JSON.parse(toReturn);
  console.log(toReturn);
  return toReturn;
}

async function login() {
  ig.state.generateDevice(username);
  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize();
    delete serialized.constants;
    await saveSession(serialized);
  });
  if (await sessionExists()) {
    console.log("Loading session");
    await ig.state.deserialize(await sessionLoad());
  }
  try {
    currentInstaUser = await ig.account.currentUser();
  } catch (e) {
    if (e instanceof IgLoginRequiredError) {
      await ig.simulate.preLoginFlow();
      await ig.account.login(username, password);
      process.nextTick(async () => await ig.simulate.postLoginFlow());
      currentInstaUser = await ig.account.currentUser();
    } else {
      console.log(e.stack);
    }
  }
}

async function uploadPhoto(filepath: string, caption: string) {
  return await ig.publish.photo({
    file: await readFileAsync(filepath),
    caption: caption,
  });
}

async function commentPhoto(mediaID: string, text: string) {
  return await ig.media.comment({ mediaId: mediaID, text: text });
}

async function uploadAndCommentPhoto(
  filepath: string,
  caption: string,
  comment: string
) {
  const resUpload = await uploadPhoto(filepath, caption);
  const resComment = await commentPhoto(resUpload.media.pk, comment);
  return [resComment, resUpload];
}

function sleep(sec: number) {
  const ms = sec * 1000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getToUploadItem() {
  const query = "SELECT * FROM public.to_upload FETCH FIRST ROW ONLY";
  const res = await db.query(query);
  return res.rows[0];
}

async function deleteToUploadItem(reddit_id: string) {
  const query = `DELETE FROM public.to_upload WHERE reddit_id='${reddit_id}'`;
  return await db.query(query);
}

async function insertPostInPosts(
  reddit_id: string,
  instagram_id: string,
  instagram_pk: string
) {
  const query = `INSERT INTO public.posts (reddit_id, instagram_id, instagram_pk) 
                    VALUES ('${reddit_id}', '${instagram_id}', '${instagram_pk}')`;
  return await db.query(query);
}

(async () => {
  try {
    // await login();
  } catch (e) {
    console.log("Login Failed");
    // Sleep 1h to prevent login spamming from docker restarting container
    await sleep(3600);
    return;
  }
  while (true) {
    try {
      await db.connect();
      const toUploadItem = await getToUploadItem();
      if (toUploadItem == undefined) {
        await db.end();
        // sleep 5 minutes
        await sleep(300);
        continue;
      }

      // console.log(await uploadAndCommentPhoto('images/test.jpg', 'tolle caption', 'toller kommentar'));
      await db.end();
      break;
    } catch (e) {
      console.log(e.stack);
      break;
    }
  }
})();
