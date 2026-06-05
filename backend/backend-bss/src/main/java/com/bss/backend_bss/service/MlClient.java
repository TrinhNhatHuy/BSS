package com.bss.backend_bss.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Thin HTTP client for the Python category-prediction microservice (ml-service).
 *
 * The model is a Python pickle that can't run in the JVM, so we POST a batch of
 * programs to {@code ${ml.service.url}/predict} and get back a label + confidence
 * + margin per item.
 *
 * Design: failures are swallowed and return an empty list. Callers treat "no
 * predictions" as "couldn't label right now" and leave programs unlabeled, so the
 * home page never 500s just because the ML service is down.
 */
@Slf4j
@Service
public class MlClient {

    private final RestClient restClient;

    public MlClient(RestClient.Builder builder,
                    @Value("${ml.service.url:http://localhost:5005}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    /** One program to classify. {@code channelName} is the channel display name. */
    public record Item(String name, String content, String channelName) {}

    /** One prediction, aligned by index with the request items. */
    public record Prediction(String label, Double confidence, Double margin) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PredictResponse(List<Prediction> results) {}

    /**
     * Predict categories for a batch. Returns a list aligned with {@code items},
     * or an empty list on any failure (service down, malformed response, …).
     */
    public List<Prediction> predict(List<Item> items) {
        if (items == null || items.isEmpty()) return List.of();

        List<Map<String, Object>> payloadItems = new ArrayList<>(items.size());
        for (Item it : items) {
            payloadItems.add(Map.of(
                    "name", it.name() == null ? "" : it.name(),
                    "content", it.content() == null ? "" : it.content(),
                    "channel_name", it.channelName() == null ? "" : it.channelName()
            ));
        }

        try {
            PredictResponse resp = restClient.post()
                    .uri("/predict")
                    .body(Map.of("items", payloadItems))
                    .retrieve()
                    .body(PredictResponse.class);
            if (resp == null || resp.results() == null) return List.of();
            return resp.results();
        } catch (Exception e) {
            log.warn("ML service /predict failed ({}); programs will stay unlabeled this request.",
                    e.getMessage());
            return List.of();
        }
    }
}