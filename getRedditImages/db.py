import psycopg2
import praw


class DB:
    DB_CONNECTION = None
    DB_CURSOR = None

    def __init__(self, host, username, password, dbname):
        try:
            self.DB_CONNECTION = psycopg2.connect(
                host=host,
                user=username,
                password=password,
                dbname=dbname
            )
            self.DB_CURSOR = self.DB_CONNECTION.cursor()
        except:
            raise Exception("Database connection failed")

    def insert_to_upload(self, images: []):
        for image in images:
            self.DB_CURSOR.execute("INSERT INTO reddit_to_insta_schema.to_upload "
                                   "(reddit_id, filepath, caption, comment) VALUES (%s, %s, %s, %s)",
                                   (image[0], image[1], image[2], image[3]))
        self.DB_CONNECTION.commit()

    def insert_to_check(self, images: []):
        for image in images:
            self.DB_CURSOR.execute("INSERT INTO reddit_to_insta_schema.to_check "
                                   "(reddit_id, filepath, caption, comment) VALUES (%s, %s, %s, %s)",
                                   (image[0], image[1], image[2], image[3]))
        self.DB_CONNECTION.commit()

    def is_already_posted(self, reddit_id: str):
        self.DB_CURSOR.execute("SELECT EXISTS(SELECT 1 FROM reddit_to_insta_schema.already_posted WHERE (id=%s))",
                               (reddit_id,))
        return self.DB_CURSOR.fetchone()

    def insert_already_posted(self, reddit_ids: [str]):
        for reddit_id in reddit_ids:
            self.DB_CURSOR.execute("INSERT INTO reddit_to_insta_schema.already_posted (reddit_id) VALUES (%s)",
                                   (reddit_id, ))
        self.DB_CONNECTION.commit()

    def add_submission_information(self, submissions: [praw.reddit.Submission]):
        for submission in submissions:
            author = submission.author
            self.DB_CURSOR.execute("INSERT INTO reddit_to_insta_schema.authors (id, name, post_karma, comment_karma) "
                                   "VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO UPDATE",
                                   (author.id, author.name, author.link_karma, author.comment_karma))
            self.DB_CURSOR.execute("INSERT INTO reddit_to_insta_schema.submissions "
                                   "(id, created_utc, author_id, num_comments, name, permalink, score, subreddit_id, "
                                   "title, upvote_ratio) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                                   "ON CONFLICT(id) DO UPDATE",
                                   (submission.id, submission.created_utc, author.id, submission.num_comments,
                                    submission.name, submission.permalink, submission.score, submission.subreddit.id,
                                    submission.title, submission.upvote_ratio))
        self.DB_CONNECTION.commit()
