import {
  IgApiClient,
  IgLoginRequiredError,
  MediaRepositoryConfigureResponseRootObject,
} from "instagram-private-api";
import { existsSync, mkdirSync, readFile, unlink, writeFile } from "fs";
import { promisify } from "util";
import { Client } from "pg";

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlink);

// const db = new Client({
//   user: "postgresUser",
//   host: "localhost",
//   database: "redditToInstaBot",
//   password: "******",
//   port: 5432,
// });

// read parameters from env
const db = new Client();

const ig = new IgApiClient();
// @ts-ignore
let currentInstaUser = null;

// process.env.INSTAGRAM_USERNAME = "galaxy_smg950f";
// process.env.INSTAGRAM_PASSWORD = "*****";

const username = process.env.INSTAGRAM_USERNAME as string;
const password = process.env.INSTAGRAM_PASSWORD as string;

if (!(username != undefined && password != undefined)) {
  const errorString =
    "Enviroment vars not set correctly\nINSTAGRAM_USERNAME: " +
    username +
    "\nINSTAGRAM_PASSWORD: " +
    password;
  throw new Error(errorString);
}

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
  return JSON.parse(toReturn);
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
      throw new Error("Something went wrong with Instagram");
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
  return [resUpload, resComment];
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
    await login();
    await db.connect();
  } catch (e) {
    console.log("Login Failed");
    // Sleep 1h to prevent login spamming from docker restarting container
    await sleep(3600);
    return;
  }
  while (true) {
    try {
      const toUploadItem = await getToUploadItem();
      if (toUploadItem == undefined) {
        // sleep 5 minutes
        await sleep(300);
        continue;
      }

      let instagram_id = "";
      let instagram_pk = "";

      try {
        const uploadAndCommentResponse = await uploadAndCommentPhoto(
          "images/" + toUploadItem["filepath"],
          toUploadItem["caption"],
          toUploadItem["comment"]
        );

        const uploadResponse = uploadAndCommentResponse[0] as MediaRepositoryConfigureResponseRootObject;
        // const commentResponse = uploadAndCommentResponse[1];

        instagram_pk = uploadResponse["media"]["pk"];
        instagram_id = uploadResponse["media"]["id"];
      } catch (e) {
        console.log("Upload with id: " + toUploadItem["reddit_id"] + " failed");
        console.log(e);
      }

      await insertPostInPosts(
        toUploadItem["reddit_id"],
        instagram_id,
        instagram_pk
      );
      await deleteToUploadItem(toUploadItem["reddit_id"]);

      try {
        await unlinkAsync("images/" + toUploadItem["filepath"]);
      } catch (e) {
        console.log(e);
        console.log("Failed to delete " + toUploadItem["filepath"]);
      }
      await sleep(300);
    } catch (e) {
      console.log(e.stack);
      await sleep(3600);
    }
  }
})();
