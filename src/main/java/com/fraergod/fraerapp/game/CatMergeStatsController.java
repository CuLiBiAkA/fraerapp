package com.fraergod.fraerapp.game;

import java.util.Locale;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
class CatMergeStatsController {
    private static final String UUID4 = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
    private final CatMergeStatsService stats;
    private final CurrentUserService users;
    CatMergeStatsController(CatMergeStatsService stats, CurrentUserService users) { this.stats = stats; this.users = users; }

    record Visit(@NotNull @Pattern(regexp = UUID4) String visitorId) {}
    record Start(@NotNull @Pattern(regexp = UUID4) String visitorId, @NotNull @Pattern(regexp = UUID4) String gameId) {}
    record Finish(@NotNull @Pattern(regexp = UUID4) String visitorId,
                  @NotNull @Pattern(regexp = "lost|won|restarted") String outcome,
                  @NotNull @Min(0) @Max(100000000) Integer score,
                  @NotNull @Min(1) @Max(100000) Integer drops,
                  @NotNull @Min(0) @Max(99999) Integer merges,
                  @NotNull @Min(0) @Max(8) Integer highestLevel,
                  @NotNull @Min(0) @Max(86400) Integer durationSeconds) {}

    @PostMapping(value = "/api/experiments/cat-merge/visit", consumes = "application/json")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void visit(@Valid @RequestBody Visit value) { stats.visit(value.visitorId().toLowerCase(Locale.ROOT)); }

    @PostMapping(value = "/api/experiments/cat-merge/games", consumes = "application/json")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void start(@Valid @RequestBody Start value) { stats.start(value.visitorId().toLowerCase(Locale.ROOT), value.gameId().toLowerCase(Locale.ROOT)); }

    @PostMapping(value = "/api/experiments/cat-merge/games/{gameId}/finish", consumes = "application/json")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void finish(@PathVariable UUID gameId, @Valid @RequestBody Finish value) { stats.finish(gameId.toString(), value); }

    @GetMapping("/api/admin/experiments/cat-merge")
    CatMergeStatsService.Stats stats() { users.requireAdmin(); return stats.stats(); }
}
