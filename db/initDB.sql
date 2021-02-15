create table already_posted
(
    id   varchar(25) not null
        constraint already_posted_pk
            primary key,
    time timestamp default CURRENT_TIMESTAMP
);

create unique index already_posted_id_uindex
    on already_posted (id);

create table authors
(
    id            varchar(25) not null
        constraint authors_pk
            primary key,
    name          varchar(60),
    post_karma    integer,
    comment_karma integer
);

create table submissions
(
    id           varchar(25) not null
        constraint submissions_pk
            primary key,
    created_utc  integer,
    author_id    varchar(25)
        constraint submissions_authors_id_fk
            references authors,
    num_comments integer,
    name         varchar(40),
    permalink    varchar(80),
    score        integer,
    subreddit_id varchar(25),
    title        varchar(80),
    upvote_ratio double precision,
    date         timestamp default CURRENT_TIMESTAMP
);

create table to_upload
(
    reddit_id varchar not null
        constraint to_upload_pk
            primary key
        constraint to_upload_submissions_id_fk
            references submissions,
    filepath  varchar,
    caption   varchar,
    comment   varchar,
    date      timestamp default CURRENT_TIMESTAMP
);

create unique index to_upload_reddit_id_uindex
    on to_upload (reddit_id);

create table posts
(
    reddit_id    varchar(25)
        constraint posts_submissions_id_fk
            references submissions,
    instagram_id varchar(90),
    instagram_pk varchar(25),
    date         timestamp default CURRENT_TIMESTAMP
);

create table to_check
(
    reddit_id varchar(25) not null
        constraint to_check_pk
            primary key
        constraint to_check_submissions_id_fk
            references submissions,
    filepath  varchar(90),
    caption   varchar(70),
    comment   varchar(90),
    date      timestamp default CURRENT_TIMESTAMP
);

