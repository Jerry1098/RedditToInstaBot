import io
import praw
import os
from PIL import Image
import urllib.request
from google.cloud import vision
from db import DB
from dotenv import load_dotenv
import time

load_dotenv()

db_hostname = os.getenv('DB_HOSTNAME')
db_username = os.getenv('DB_USERNAME')
db_password = os.getenv('DB_PASSWORD')
db_database = os.getenv('DB_DATABASE')

print(db_hostname, db_username, db_password, db_database)

reddit_client_id = os.getenv('REDDIT_CLIENT_ID')
reddit_client_secret = os.getenv('REDDIT_CLIENT_SECRET')
reddit_useragent = os.getenv('REDDIT_USERAGENT')
reddit_username = os.getenv('REDDIT_USERNAME')
reddit_password = os.getenv('REDDIT_PASSWORD')
reddit_subreddit = os.getenv('REDDIT_SUBREDDIT')

img_dir = os.getenv('IMG_DIR')

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.abspath('./client_secrets.json')

if not os.path.isdir(img_dir):
    os.makedirs(img_dir)


def convert_image(img_to_cov: Image):
    x, y = img_to_cov.size
    if x > y:
        new_x = 1024
        aspect_ratio = new_x / x
        new_y = int(y * aspect_ratio)
    else:
        new_y = 1024
        aspect_ratio = new_y / y
        new_x = int(x * aspect_ratio)
    img_to_cov = img_to_cov.resize((new_x, new_y), Image.ANTIALIAS)
    img2 = Image.new('RGB', (1024, 1024), color='WHITE')
    x, y = img_to_cov.size
    x = int((1024 - x) / 2)
    y = int((1024 - y) / 2)
    img2.paste(img_to_cov, (x, y))
    return img2


def image_to_byte_array(image: Image):
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='jpeg')
    return img_byte_arr.getvalue()


def check_image_for_nsfw(image: Image):
    image_bytes = image_to_byte_array(image)
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.safe_search_detection(image=image)
    safe = response.safe_search_annotation
    if safe.adult > 4 or safe.medical > 4 or safe.violence > 4 or safe.racy > 4:
        return False
    return True


db = DB(db_hostname, db_username, db_password, db_database)
reddit = praw.Reddit(
    client_id=reddit_client_id,
    client_secret=reddit_client_secret,
    user_agent=reddit_useragent,
    username=reddit_username,
    password=reddit_password
)
subreddit = reddit.subreddit(reddit_subreddit)

while True:
    submission_information = []
    to_check_information = []
    to_upload_information = []
    already_posted_list = []
    for submission in subreddit.top('day', limit=12):
        if not db.is_already_posted(submission.id):
            try:
                download_ulr = submission.url
                if 'imgur' in submission.url and not (submission.url.endswith('.jpg') or submission.url.endswith('.png')):
                    download_ulr = download_ulr + '.jpg'
                path = io.BytesIO(urllib.request.urlopen(download_ulr).read())
                img = Image.open(path).convert('RGB')
                img = convert_image(img)
                img.save(os.path.join(img_dir, submission.id + '.jpg'))
                comment = f'Pfostiert von: /u/{submission.author.name} Pfostierung zu finden unter: ' \
                          f'redd.it/{submission.id}'
                img_info = (submission.id, submission.id + '.jpg', submission.title, comment)
                if check_image_for_nsfw(img):
                    to_upload_information.append(img_info)
                else:
                    to_check_information.append(img_info)
                already_posted_list.append(submission.id)
                submission_information.append(submission)
            except Exception as e:
                print(e)

    db.add_submission_information(submission_information)
    db.insert_already_posted(already_posted_list)
    db.insert_to_upload(to_upload_information)
    db.insert_to_check(to_check_information)

    # sleep for 30 min
    time.sleep(1800)
