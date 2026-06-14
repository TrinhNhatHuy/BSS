CREATE TABLE channel_group (
                               id          BIGSERIAL    PRIMARY KEY,
                               name        VARCHAR(50)  NOT NULL,
                               create_time TIMESTAMP(6) DEFAULT NULL,
                               update_time TIMESTAMP(6) DEFAULT NULL
);

CREATE TABLE source (
                        name        VARCHAR(50)  NOT NULL PRIMARY KEY,
                        url         VARCHAR(500) DEFAULT NULL,
                        status      BOOLEAN      NOT NULL DEFAULT TRUE,
                        create_time TIMESTAMP(6) DEFAULT NULL,
                        update_time TIMESTAMP(6) DEFAULT NULL,
                        priority    INTEGER
                            CONSTRAINT chk_source_priority CHECK (priority IS NULL OR priority >= 1)
);

CREATE INDEX idx_source_priority ON source(priority);

CREATE TABLE users (
                       id           BIGSERIAL    PRIMARY KEY,
                       username     VARCHAR(100) NOT NULL,
                       password     VARCHAR(255) DEFAULT NULL,
                       email        VARCHAR(255) DEFAULT NULL,
                       display_name VARCHAR(255) DEFAULT NULL,
                       role         VARCHAR(20)  NOT NULL DEFAULT 'USER'
                           CHECK (role IN ('ADMIN', 'EDITOR', 'USER')),
                       status       BOOLEAN      NOT NULL DEFAULT TRUE,
                       telegram_chat_id   VARCHAR(50) DEFAULT NULL,
                       telegram_link_code VARCHAR(20) DEFAULT NULL,
                       create_time  TIMESTAMP(6) DEFAULT NULL,
                       update_time  TIMESTAMP(6) DEFAULT NULL,
                       CONSTRAINT uk_username UNIQUE (username),
                       CONSTRAINT uk_email    UNIQUE (email)
);

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

CREATE TABLE channel_export_id (
                                   channel_id  VARCHAR(255) NOT NULL,
                                   type        VARCHAR(10)  NOT NULL
                                       CONSTRAINT chk_cei_type CHECK (type IN ('HD', 'SD', 'None')),
                                   external_id VARCHAR(100) NOT NULL,
                                   create_time TIMESTAMP(6) DEFAULT NULL,
                                   update_time TIMESTAMP(6) DEFAULT NULL,
                                   PRIMARY KEY (channel_id, type),
                                   CONSTRAINT fk_cei_channel
                                       FOREIGN KEY (channel_id) REFERENCES channel(id)
                                           ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_cei_channel ON channel_export_id(channel_id);
CREATE INDEX idx_cei_type    ON channel_export_id(type);

CREATE TABLE draft_batch (
                             id            BIGSERIAL    PRIMARY KEY,
                             channel_id    VARCHAR(255) NOT NULL,
                             created_by    BIGINT       NOT NULL,
                             status        VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING'
                                 CHECK (status IN




                                        ('PROCESSING', 'COMPLETED', 'APPROVED')),
                             program_date  VARCHAR(14)   DEFAULT NULL,
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

CREATE TABLE program (
                         id             BIGSERIAL    PRIMARY KEY,
                         channel_id     VARCHAR(255) DEFAULT NULL,
                         draft_batch_id BIGINT       DEFAULT NULL,
                         begin_time     VARCHAR(14)  NOT NULL,
                         end_time       VARCHAR(14)  NOT NULL,
                         name           VARCHAR(500) DEFAULT NULL,
                         content        VARCHAR(500) DEFAULT NULL,
                         category       VARCHAR(20)  DEFAULT NULL
                             CHECK (category IN ('SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others')),
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
CREATE INDEX idx_program_live          ON program(channel_id, begin_time)
    WHERE draft_batch_id IS NULL;

CREATE TABLE reschedule_log (
                                id                  BIGSERIAL    PRIMARY KEY,
                                channel_id          VARCHAR(255) DEFAULT NULL,
                                status              VARCHAR(20)  NOT NULL
                                    CHECK (status IN ('ADDED', 'MODIFIED', 'DELETED')),
                                begin_time          VARCHAR(14)  DEFAULT NULL,
                                end_time            VARCHAR(14)  DEFAULT NULL,
                                name                VARCHAR(500) DEFAULT NULL,
                                content             VARCHAR(500) DEFAULT NULL,
                                original_begin_time VARCHAR(14)  DEFAULT NULL,
                                original_end_time   VARCHAR(14)  DEFAULT NULL,
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

CREATE TABLE program_label (
                               id           BIGSERIAL    PRIMARY KEY,
                               program_id   BIGINT       NOT NULL,
                               category     VARCHAR(20)  NOT NULL
                                   CHECK (category IN ('SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others')),
                               label_source VARCHAR(20)  NOT NULL DEFAULT 'GEMINI'
                                   CHECK (label_source IN ('GEMINI', 'HUMAN', 'MODEL_V1', 'MODEL_V2')),
                               is_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
                               note         VARCHAR(500) DEFAULT NULL,
                               create_time  TIMESTAMP(6) DEFAULT NULL,
                               update_time  TIMESTAMP(6) DEFAULT NULL,
                               CONSTRAINT fk_pl_program
                                   FOREIGN KEY (program_id) REFERENCES program(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE,
                               CONSTRAINT uk_program_label UNIQUE (program_id, label_source)
);

CREATE INDEX idx_program_label_program  ON program_label(program_id);
CREATE INDEX idx_program_label_category ON program_label(category);
CREATE INDEX idx_program_label_training ON program_label(category)
    WHERE is_verified = TRUE;

CREATE TABLE user_preference (
                                 id          BIGSERIAL    PRIMARY KEY,
                                 user_id     BIGINT       NOT NULL,
                                 category    VARCHAR(20)  NOT NULL
                                     CHECK (category IN ('SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others')),
                                 create_time TIMESTAMP(6) DEFAULT NULL,
                                 CONSTRAINT uk_user_preference UNIQUE (user_id, category),
                                 CONSTRAINT fk_up_user
                                     FOREIGN KEY (user_id) REFERENCES users(id)
                                         ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_user_preference_user ON user_preference(user_id);

CREATE TABLE user_bookmark (
                               id          BIGSERIAL PRIMARY KEY,
                               user_id     BIGINT    NOT NULL,
                               program_id  BIGINT    NOT NULL,
                               create_time TIMESTAMP(6) DEFAULT NULL,
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

CREATE TABLE user_reminder (
                               id             BIGSERIAL    PRIMARY KEY,
                               user_id        BIGINT       NOT NULL,
                               program_id     BIGINT       NOT NULL,
                               remind_at      TIMESTAMP(6) NOT NULL,
                               minutes_before INTEGER      NOT NULL DEFAULT 0,
                               channel        VARCHAR(20)  NOT NULL DEFAULT 'WEBPUSH'
                                   CHECK (channel IN ('WEBPUSH', 'TELEGRAM', 'BOTH')),
                               is_sent        BOOLEAN      NOT NULL DEFAULT FALSE,
                               create_time    TIMESTAMP(6) DEFAULT NULL,
                               update_time    TIMESTAMP(6) DEFAULT NULL,
                               CONSTRAINT uk_user_reminder UNIQUE (user_id, program_id),
                               CONSTRAINT fk_ur_user
                                   FOREIGN KEY (user_id) REFERENCES users(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE,
                               CONSTRAINT fk_ur_program
                                   FOREIGN KEY (program_id) REFERENCES program(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_reminder_user   ON user_reminder(user_id);
CREATE INDEX idx_reminder_unsent ON user_reminder(remind_at)
    WHERE is_sent = FALSE;

-- Web Push subscriptions — one row per browser/device per user.
CREATE TABLE push_subscription (
                               id          BIGSERIAL     PRIMARY KEY,
                               user_id     BIGINT        NOT NULL,
                               endpoint    VARCHAR(1000) NOT NULL,
                               p256dh      VARCHAR(255)  NOT NULL,
                               auth        VARCHAR(255)  NOT NULL,
                               user_agent  VARCHAR(500)  DEFAULT NULL,
                               create_time TIMESTAMP(6)  DEFAULT NULL,
                               CONSTRAINT uk_push_subscription_endpoint UNIQUE (endpoint),
                               CONSTRAINT fk_ps_user
                                   FOREIGN KEY (user_id) REFERENCES users(id)
                                       ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_push_subscription_user ON push_subscription(user_id);

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

-- Unified implicit-interaction log that powers the personalized USER home page.
-- One row per behavioral signal (program opened, watched, searched, …). Bookmarks
-- and reminders live in their own tables (they back UI state + are the strongest
-- explicit signals); the recommender reads all of them together. Channel/category/
-- begin_time/program_name are SNAPSHOT at event time so the signal survives the
-- per-airing rotation of program rows (program may later be deleted -> program_id
-- set NULL, but the snapshot columns remain analyzable). Insert-only (no update_time).
CREATE TABLE user_event (
                            id           BIGSERIAL    PRIMARY KEY,
                            user_id      BIGINT       NOT NULL,
                            event_type   VARCHAR(20)  NOT NULL
                                CHECK (event_type IN ('VIEW', 'CLICK', 'WATCH', 'SEARCH')),
                            program_id   BIGINT       DEFAULT NULL,
                            channel_id   VARCHAR(255) DEFAULT NULL,
                            category     VARCHAR(20)  DEFAULT NULL
                                CHECK (category IS NULL OR category IN
                                       ('SeriesVN', 'SeriesFR', 'Kids', 'Music', 'Sports', 'News', 'Others')),
                            begin_time   VARCHAR(14)  DEFAULT NULL,
                            program_name VARCHAR(500) DEFAULT NULL,
                            keyword      VARCHAR(255) DEFAULT NULL,
                            create_time  TIMESTAMP(6) DEFAULT NULL,
                            CONSTRAINT fk_ue_user
                                FOREIGN KEY (user_id) REFERENCES users(id)
                                    ON UPDATE CASCADE ON DELETE CASCADE,
                            CONSTRAINT fk_ue_program
                                FOREIGN KEY (program_id) REFERENCES program(id)
                                    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_user_event_user     ON user_event(user_id, create_time DESC);
CREATE INDEX idx_user_event_type     ON user_event(event_type);
CREATE INDEX idx_user_event_program  ON user_event(program_id);
CREATE INDEX idx_user_event_category ON user_event(category);

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
                       'channel_export_id',
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