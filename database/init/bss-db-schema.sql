-- ============================================================
-- TV360 BROADCAST SCHEDULER — PostgreSQL Schema v4
-- Features:
--   1. Broadcast schedule crawling + AI cleaning (core)
--   2. Program category classification model training
--   3. Personalized TV schedule recommendation for users
-- ============================================================


-- ============================================================
-- CHANNEL GROUP
-- ============================================================

CREATE TABLE channel_group (
                               id          BIGSERIAL   PRIMARY KEY,
                               name        VARCHAR(50) NOT NULL,
                               create_time TIMESTAMP(6) DEFAULT NULL,
                               update_time TIMESTAMP(6) DEFAULT NULL
);


-- ============================================================
-- SOURCE
-- Websites or emails n8n crawls schedule data from.
-- ============================================================

CREATE TABLE source (
                        name        VARCHAR(50)  NOT NULL PRIMARY KEY,
                        url         VARCHAR(500) DEFAULT NULL,
                        status      BOOLEAN      NOT NULL DEFAULT TRUE,
                        create_time TIMESTAMP(6) DEFAULT NULL,
                        update_time TIMESTAMP(6) DEFAULT NULL
);


-- ============================================================
-- USERS
-- Three roles: ADMIN | EDITOR | USER
--   ADMIN  → manage system, users, sources
--   EDITOR → review and approve AI-cleaned schedules
--   USER   → view personalized schedule, bookmark, set reminders
-- ============================================================

CREATE TABLE users (
                       id           BIGSERIAL    PRIMARY KEY,
                       username     VARCHAR(100) NOT NULL,
                       password     VARCHAR(255) DEFAULT NULL,
                       email        VARCHAR(255) DEFAULT NULL,
                       display_name VARCHAR(255) DEFAULT NULL,
                       role         VARCHAR(20)  NOT NULL DEFAULT 'USER'
                           CHECK (role IN ('ADMIN', 'EDITOR', 'USER')),
                       status       BOOLEAN      NOT NULL DEFAULT TRUE,
                       create_time  TIMESTAMP(6) DEFAULT NULL,
                       update_time  TIMESTAMP(6) DEFAULT NULL,
                       CONSTRAINT uk_username UNIQUE (username),
                       CONSTRAINT uk_email    UNIQUE (email)
);


-- ============================================================
-- CHANNEL
-- ============================================================

CREATE TABLE channel (
                         id                    VARCHAR(255) NOT NULL PRIMARY KEY,
                         name                  VARCHAR(50)  NOT NULL,
                         channel_group_id      BIGINT       DEFAULT NULL,
                         number_of_reschedules INTEGER      NOT NULL DEFAULT 0,
                         ai_update_status      VARCHAR(20)  NOT NULL DEFAULT 'NOT_UPDATED'
                             CHECK (ai_update_status IN ('NOT_UPDATED', 'UPDATED')),
                         last_ai_update_time   TIMESTAMP(6) DEFAULT NULL,
                         last_ai_update_by     BIGINT       DEFAULT NULL,
                         create_time           TIMESTAMP(6) DEFAULT NULL,
                         update_time           TIMESTAMP(6) DEFAULT NULL,
                         CONSTRAINT fk_channel_group
                             FOREIGN KEY (channel_group_id) REFERENCES channel_group(id)
                                 ON UPDATE CASCADE ON DELETE SET NULL,
                         CONSTRAINT fk_channel_ai_user
                             FOREIGN KEY (last_ai_update_by) REFERENCES users(id)
                                 ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_channel_group_id ON channel(channel_group_id);
CREATE INDEX idx_channel_ai_user  ON channel(last_ai_update_by);


-- ============================================================
-- CHANNEL SOURCE  (junction: channel <-> source)
-- ============================================================

CREATE TABLE channel_source (
                                source_name VARCHAR(50)  NOT NULL,
                                channel_id  VARCHAR(255) NOT NULL,
                                PRIMARY KEY (source_name, channel_id),
                                CONSTRAINT fk_cs_channel
                                    FOREIGN KEY (channel_id) REFERENCES channel(id)
                                        ON UPDATE CASCADE ON DELETE CASCADE,
                                CONSTRAINT fk_cs_source
                                    FOREIGN KEY (source_name) REFERENCES source(name)
                                        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_cs_channel ON channel_source(channel_id);


-- ============================================================
-- DRAFT BATCH
-- One batch = one AI cleaning run for one channel + one date.
-- Status flow: PROCESSING → COMPLETED → APPROVED
-- ============================================================

CREATE TABLE draft_batch (
                             id            BIGSERIAL    PRIMARY KEY,
                             channel_id    VARCHAR(255) NOT NULL,
                             created_by    BIGINT       NOT NULL,
                             status        VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING'
                                 CHECK (status IN ('PROCESSING', 'COMPLETED', 'APPROVED')),
                             program_date  DATE         DEFAULT NULL,
                             approved_time TIMESTAMP(6) DEFAULT NULL,
                             approved_by   BIGINT       DEFAULT NULL,
                             create_time   TIMESTAMP(6) DEFAULT NULL,
                             update_time   TIMESTAMP(6) DEFAULT NULL,
                             CONSTRAINT fk_db_channel
                                 FOREIGN KEY (channel_id) REFERENCES channel(id)
                                     ON UPDATE CASCADE,
                             CONSTRAINT fk_db_created_by
                                 FOREIGN KEY (created_by) REFERENCES users(id)
                                     ON UPDATE CASCADE,
                             CONSTRAINT fk_db_approved_by
                                 FOREIGN KEY (approved_by) REFERENCES users(id)
                                     ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_draft_batch_channel_date ON draft_batch(channel_id, program_date);
CREATE INDEX idx_draft_batch_status       ON draft_batch(status);


-- ============================================================
-- PROGRAM
--
-- begin_time / end_time: TIMESTAMPTZ
-- Raw '20260418055000' is parsed in Spring Boot before insert:
--   DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
--   ZonedDateTime zdt = LocalDateTime.parse(raw, fmt)
--                         .atZone(ZoneId.of("Asia/Ho_Chi_Minh"));
--
-- draft_batch_id IS NULL  → live / approved program
-- draft_batch_id NOT NULL → AI draft pending editor review
--
-- category: populated by your trained classification model
--   NULL = not yet classified
--   filled = model has predicted the category
-- ============================================================

CREATE TABLE program (
                         id             BIGSERIAL    PRIMARY KEY,
                         channel_id     VARCHAR(255) DEFAULT NULL,
                         draft_batch_id BIGINT       DEFAULT NULL,
                         begin_time     TIMESTAMPTZ  NOT NULL,
                         end_time       TIMESTAMPTZ  NOT NULL,
                         name           VARCHAR(500) DEFAULT NULL,
                         content        VARCHAR(500) DEFAULT NULL,
    -- Populated by classification model after training
                         category       VARCHAR(20)  DEFAULT NULL
                             CHECK (category IN (
                                                 'SeriesVN', 'SeriesCN', 'SeriesKR',
                                                 'Kids', 'Music', 'Sports', 'News', 'Others'
                                 )),
                         create_time    TIMESTAMP(6) DEFAULT NULL,
                         update_time    TIMESTAMP(6) DEFAULT NULL,
                         CONSTRAINT fk_program_channel
                             FOREIGN KEY (channel_id) REFERENCES channel(id)
                                 ON UPDATE CASCADE ON DELETE SET NULL,
                         CONSTRAINT fk_program_draft_batch
                             FOREIGN KEY (draft_batch_id) REFERENCES draft_batch(id)
                                 ON DELETE CASCADE
);

CREATE INDEX idx_program_channel       ON program(channel_id);
CREATE INDEX idx_program_draft_batch   ON program(draft_batch_id);
CREATE INDEX idx_program_channel_draft ON program(channel_id, draft_batch_id);
CREATE INDEX idx_program_category      ON program(category);
-- Fast lookup of live approved programs only
CREATE INDEX idx_program_live          ON program(channel_id, begin_time)
    WHERE draft_batch_id IS NULL;


-- ============================================================
-- RESCHEDULE LOG
-- Records every change made to live programs during the day.
-- status: 'ADDED' | 'MODIFIED' | 'DELETED'
-- ============================================================

CREATE TABLE reschedule_log (
                                id                  BIGSERIAL    PRIMARY KEY,
                                channel_id          VARCHAR(255) DEFAULT NULL,
                                status              VARCHAR(20)  NOT NULL
                                    CHECK (status IN ('ADDED', 'MODIFIED', 'DELETED')),
                                begin_time          TIMESTAMPTZ  DEFAULT NULL,
                                end_time            TIMESTAMPTZ  DEFAULT NULL,
                                name                VARCHAR(500) DEFAULT NULL,
                                content             VARCHAR(500) DEFAULT NULL,
                                original_begin_time TIMESTAMPTZ  DEFAULT NULL,
                                original_end_time   TIMESTAMPTZ  DEFAULT NULL,
                                original_name       VARCHAR(500) DEFAULT NULL,
                                original_content    VARCHAR(500) DEFAULT NULL,
                                create_time         TIMESTAMP(6) DEFAULT NULL,
                                update_time         TIMESTAMP(6) DEFAULT NULL,
                                CONSTRAINT fk_rl_channel
                                    FOREIGN KEY (channel_id) REFERENCES channel(id)
                                        ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_reschedule_channel      ON reschedule_log(channel_id);
CREATE INDEX idx_reschedule_channel_time ON reschedule_log(channel_id, create_time DESC);


-- ============================================================
-- CRAWL JOB
-- Tracks every n8n pipeline execution for schedule crawling.
-- ============================================================

CREATE TABLE crawl_job (
                           id            BIGSERIAL    PRIMARY KEY,
                           source_name   VARCHAR(50)  NOT NULL,
                           channel_id    VARCHAR(255) DEFAULT NULL,
                           status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL')),
                           raw_payload   TEXT         DEFAULT NULL,
                           error_message TEXT         DEFAULT NULL,
                           started_at    TIMESTAMP(6) DEFAULT NULL,
                           finished_at   TIMESTAMP(6) DEFAULT NULL,
                           create_time   TIMESTAMP(6) DEFAULT NULL,
                           CONSTRAINT fk_cj_source
                               FOREIGN KEY (source_name) REFERENCES source(name)
                                   ON UPDATE CASCADE,
                           CONSTRAINT fk_cj_channel
                               FOREIGN KEY (channel_id) REFERENCES channel(id)
                                   ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_crawl_job_source  ON crawl_job(source_name);
CREATE INDEX idx_crawl_job_channel ON crawl_job(channel_id, create_time DESC);
CREATE INDEX idx_crawl_job_status  ON crawl_job(status);


-- ============================================================
-- ============================================================
-- FEATURE 1: PROGRAM CATEGORY CLASSIFICATION
--
-- Workflow:
--   Step 1: Gemini reads program.name + program.content
--           and auto-labels each program with a category
--   Step 2: You manually verify Gemini's labels (spot check)
--           and mark is_verified = TRUE on correct ones
--   Step 3: Export WHERE is_verified = TRUE as training data
--   Step 4: Train TF-IDF + SVM or fine-tune PhoBERT on it
--   Step 5: Deploy model → it writes predictions back to
--           program.category for every new crawled program
-- ============================================================
-- ============================================================


-- ============================================================
-- PROGRAM LABEL
-- Stores Gemini-generated category labels for training data.
-- Separate from program table so live schedule stays clean.
-- One row per program being labeled.
--
-- label_source:
--   'GEMINI'   → auto-labeled by Gemini (unverified)
--   'HUMAN'    → manually labeled or verified by you
--   'MODEL_V1' → predicted by your first trained model
--   'MODEL_V2' → predicted by a later version
--
-- is_verified:
--   FALSE → Gemini labeled it, not yet human-checked
--   TRUE  → you confirmed the label is correct
--           → these rows are your gold training dataset
-- ============================================================

CREATE TABLE program_label (
                               id           BIGSERIAL    PRIMARY KEY,
                               program_id   BIGINT       NOT NULL,
                               category     VARCHAR(20)  NOT NULL
                                   CHECK (category IN (
                                                       'SeriesVN', 'SeriesCN', 'SeriesKR',
                                                       'Kids', 'Music', 'Sports', 'News', 'Others'
                                       )),
                               label_source VARCHAR(20)  NOT NULL DEFAULT 'GEMINI'
                                   CHECK (label_source IN ('GEMINI', 'HUMAN', 'MODEL_V1', 'MODEL_V2')),
                               is_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
                               note         VARCHAR(500) DEFAULT NULL,  -- optional reason if human corrects a label
                               create_time  TIMESTAMP(6) DEFAULT NULL,
                               update_time  TIMESTAMP(6) DEFAULT NULL,
                               CONSTRAINT fk_pl_program
                                   FOREIGN KEY (program_id) REFERENCES program(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE,
    -- One label row per program per label source
                               CONSTRAINT uk_program_label UNIQUE (program_id, label_source)
);

CREATE INDEX idx_program_label_program  ON program_label(program_id);
CREATE INDEX idx_program_label_category ON program_label(category);
-- Training data export index: verified human labels only
CREATE INDEX idx_program_label_training ON program_label(category)
    WHERE is_verified = TRUE;


-- ============================================================
-- ============================================================
-- FEATURE 2: PERSONALIZED SCHEDULE RECOMMENDATION
--
-- USER role only. Three signals feed the recommendation:
--   1. user_preference  → categories chosen at registration
--   2. user_bookmark    → programs explicitly saved
--   3. user_search_log  → what the user searches for
--   4. user_reminder    → programs the user set a watch alert
--
-- Recommendation logic in Spring Boot:
--   Priority 1: upcoming programs matching bookmarked channels
--   Priority 2: programs matching preferred categories
--   Priority 3: programs similar to search history keywords
-- ============================================================
-- ============================================================


-- ============================================================
-- USER PREFERENCE
-- Categories a USER selects at registration or in settings.
-- One row per category per user.
-- ============================================================

CREATE TABLE user_preference (
                                 id          BIGSERIAL   PRIMARY KEY,
                                 user_id     BIGINT      NOT NULL,
                                 category    VARCHAR(20) NOT NULL
                                     CHECK (category IN (
                                                         'SeriesVN', 'SeriesCN', 'SeriesKR',
                                                         'Kids', 'Music', 'Sports', 'News', 'Others'
                                         )),
                                 create_time TIMESTAMP(6) DEFAULT NULL,
    -- One row per user per category — no duplicates
                                 CONSTRAINT uk_user_preference UNIQUE (user_id, category),
                                 CONSTRAINT fk_up_user
                                     FOREIGN KEY (user_id) REFERENCES users(id)
                                         ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_user_preference_user ON user_preference(user_id);


-- ============================================================
-- USER BOOKMARK
-- Programs a USER explicitly saves to watch later.
-- ============================================================

CREATE TABLE user_bookmark (
                               id          BIGSERIAL PRIMARY KEY,
                               user_id     BIGINT    NOT NULL,
                               program_id  BIGINT    NOT NULL,
                               create_time TIMESTAMP(6) DEFAULT NULL,
    -- A user can only bookmark the same program once
                               CONSTRAINT uk_user_bookmark UNIQUE (user_id, program_id),
                               CONSTRAINT fk_ub_user
                                   FOREIGN KEY (user_id) REFERENCES users(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE,
                               CONSTRAINT fk_ub_program
                                   FOREIGN KEY (program_id) REFERENCES program(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_bookmark_user    ON user_bookmark(user_id);
CREATE INDEX idx_bookmark_program ON user_bookmark(program_id);


-- ============================================================
-- USER WATCH REMINDER
-- A USER sets an alert for a program they want to watch.
-- is_sent = TRUE once the notification has been delivered.
-- ============================================================

CREATE TABLE user_reminder (
                               id          BIGSERIAL PRIMARY KEY,
                               user_id     BIGINT    NOT NULL,
                               program_id  BIGINT    NOT NULL,
                               remind_at   TIMESTAMPTZ NOT NULL,  -- when to send the notification
                               is_sent     BOOLEAN   NOT NULL DEFAULT FALSE,
                               create_time TIMESTAMP(6) DEFAULT NULL,
                               update_time TIMESTAMP(6) DEFAULT NULL,
    -- A user can only set one reminder per program
                               CONSTRAINT uk_user_reminder UNIQUE (user_id, program_id),
                               CONSTRAINT fk_ur_user
                                   FOREIGN KEY (user_id) REFERENCES users(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE,
                               CONSTRAINT fk_ur_program
                                   FOREIGN KEY (program_id) REFERENCES program(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_reminder_user        ON user_reminder(user_id);
CREATE INDEX idx_reminder_unsent      ON user_reminder(remind_at)
    WHERE is_sent = FALSE;


-- ============================================================
-- USER SEARCH LOG
-- Records every search query a USER makes.
-- Used to improve recommendations over time.
-- keyword: the raw text the user typed in the search box.
-- result_count: how many programs were returned.
-- ============================================================

CREATE TABLE user_search_log (
                                 id           BIGSERIAL    PRIMARY KEY,
                                 user_id      BIGINT       NOT NULL,
                                 keyword      VARCHAR(255) NOT NULL,
                                 result_count INTEGER      NOT NULL DEFAULT 0,
                                 create_time  TIMESTAMP(6) DEFAULT NULL,
                                 CONSTRAINT fk_usl_user
                                     FOREIGN KEY (user_id) REFERENCES users(id)
                                         ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_search_log_user    ON user_search_log(user_id);
CREATE INDEX idx_search_log_keyword ON user_search_log(keyword);
CREATE INDEX idx_search_log_time    ON user_search_log(user_id, create_time DESC);


-- ============================================================
-- AUTO-UPDATE update_time TRIGGER
-- Automatically stamps update_time on every row update.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_update_time()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.update_time = NOW();
RETURN NEW;
END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
FOR t IN SELECT unnest(ARRAY[
                           'channel_group',
                       'source',
                       'users',
                       'channel',
                       'draft_batch',
                       'program',
                       'reschedule_log',
                       'program_label',
                       'user_reminder'
                           ]) LOOP
             EXECUTE format(
            'CREATE TRIGGER trg_%I_update_time
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_set_update_time()',
            t, t
        );
END LOOP;
END $$;