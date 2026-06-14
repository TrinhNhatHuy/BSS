package com.bss.backend_bss.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.time.ZoneId;

/**
 * Enables @Scheduled tasks (reminder firing + Telegram long-poll) and exposes
 * the reminder time zone as a bean.
 *
 * Program times are stored as local wall-clock strings (Vietnam time), but the
 * containers/DB run in UTC — so all reminder math is pinned to
 * {@code app.reminder.zone} to avoid firing notifications hours off.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {

    @Bean
    public ZoneId reminderZone(@Value("${app.reminder.zone:Asia/Ho_Chi_Minh}") String zone) {
        return ZoneId.of(zone);
    }

    /** A small pool so the 60s reminder sweep and the 3s Telegram poll don't block each other. */
    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("bss-sched-");
        return scheduler;
    }
}