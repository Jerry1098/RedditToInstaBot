"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const instagram_private_api_1 = require("instagram-private-api");
const fs_1 = require("fs");
const util_1 = require("util");
const pg_1 = require("pg");
const readFileAsync = util_1.promisify(fs_1.readFile);
const writeFileAsync = util_1.promisify(fs_1.writeFile);
const unlinkAsync = util_1.promisify(fs_1.unlink);
const db = new pg_1.Client();
const ig = new instagram_private_api_1.IgApiClient();
let currentInstaUser = null;
const username = process.env.INSTAGRAM_USERNAME;
const password = process.env.INSTAGRAM_PASSWORD;
if (!(username != undefined && password != undefined)) {
    const errorString = "Enviroment vars not set correctly\nINSTAGRAM_USERNAME: " +
        username +
        "\nINSTAGRAM_PASSWORD: " +
        password;
    throw new Error(errorString);
}
const sessionPath = "./data";
const sessionFilename = "/session.json";
function saveSession(data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.existsSync(sessionPath)) {
            fs_1.mkdirSync(sessionPath);
        }
        yield writeFileAsync(sessionPath + sessionFilename, JSON.stringify(data), "utf8");
    });
}
function sessionExists() {
    return __awaiter(this, void 0, void 0, function* () {
        return fs_1.existsSync(sessionPath + sessionFilename);
    });
}
function sessionLoad() {
    return __awaiter(this, void 0, void 0, function* () {
        let toReturn = yield readFileAsync(sessionPath + sessionFilename, "utf8");
        return JSON.parse(toReturn);
    });
}
function login() {
    return __awaiter(this, void 0, void 0, function* () {
        ig.state.generateDevice(username);
        ig.request.end$.subscribe(() => __awaiter(this, void 0, void 0, function* () {
            const serialized = yield ig.state.serialize();
            delete serialized.constants;
            yield saveSession(serialized);
        }));
        if (yield sessionExists()) {
            console.log("Loading session");
            yield ig.state.deserialize(yield sessionLoad());
        }
        try {
            currentInstaUser = yield ig.account.currentUser();
        }
        catch (e) {
            if (e instanceof instagram_private_api_1.IgLoginRequiredError) {
                yield ig.simulate.preLoginFlow();
                yield ig.account.login(username, password);
                process.nextTick(() => __awaiter(this, void 0, void 0, function* () { return yield ig.simulate.postLoginFlow(); }));
                currentInstaUser = yield ig.account.currentUser();
            }
            else {
                console.log(e.stack);
                throw new Error("Something went wrong with Instagram");
            }
        }
    });
}
function uploadPhoto(filepath, caption) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield ig.publish.photo({
            file: yield readFileAsync(filepath),
            caption: caption,
        });
    });
}
function commentPhoto(mediaID, text) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield ig.media.comment({ mediaId: mediaID, text: text });
    });
}
function uploadAndCommentPhoto(filepath, caption, comment) {
    return __awaiter(this, void 0, void 0, function* () {
        const resUpload = yield uploadPhoto(filepath, caption);
        const resComment = yield commentPhoto(resUpload.media.pk, comment);
        return [resUpload, resComment];
    });
}
function sleep(sec) {
    const ms = sec * 1000;
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function getToUploadItem() {
    return __awaiter(this, void 0, void 0, function* () {
        const query = "SELECT * FROM public.to_upload FETCH FIRST ROW ONLY";
        const res = yield db.query(query);
        return res.rows[0];
    });
}
function deleteToUploadItem(reddit_id) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `DELETE FROM public.to_upload WHERE reddit_id='${reddit_id}'`;
        return yield db.query(query);
    });
}
function insertPostInPosts(reddit_id, instagram_id, instagram_pk) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `INSERT INTO public.posts (reddit_id, instagram_id, instagram_pk) 
                    VALUES ('${reddit_id}', '${instagram_id}', '${instagram_pk}')`;
        return yield db.query(query);
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield login();
        yield db.connect();
    }
    catch (e) {
        console.log("Login Failed");
        yield sleep(3600);
        return;
    }
    while (true) {
        try {
            const toUploadItem = yield getToUploadItem();
            if (toUploadItem == undefined) {
                yield sleep(300);
                continue;
            }
            let instagram_id = "";
            let instagram_pk = "";
            try {
                const uploadAndCommentResponse = yield uploadAndCommentPhoto("images/" + toUploadItem["filepath"], toUploadItem["caption"], toUploadItem["comment"]);
                const uploadResponse = uploadAndCommentResponse[0];
                instagram_pk = uploadResponse["media"]["pk"];
                instagram_id = uploadResponse["media"]["id"];
            }
            catch (e) {
                console.log("Upload with id: " + toUploadItem["reddit_id"] + " failed");
                console.log(e);
            }
            yield insertPostInPosts(toUploadItem["reddit_id"], instagram_id, instagram_pk);
            yield deleteToUploadItem(toUploadItem["reddit_id"]);
            try {
                yield unlinkAsync("images/" + toUploadItem["filepath"]);
            }
            catch (e) {
                console.log(e);
                console.log("Failed to delete " + toUploadItem["filepath"]);
            }
            yield sleep(300);
        }
        catch (e) {
            console.log(e.stack);
            yield sleep(3600);
        }
    }
}))();
//# sourceMappingURL=uploadImages.js.map