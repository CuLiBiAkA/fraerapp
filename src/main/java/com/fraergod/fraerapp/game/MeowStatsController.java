package com.fraergod.fraerapp.game;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
class MeowStatsController {
    private final MeowStatsService stats;
    private final CurrentUserService users;
    MeowStatsController(MeowStatsService stats, CurrentUserService users) { this.stats = stats; this.users = users; }

    record Visit(@NotNull @Pattern(regexp = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}") String visitorId) {}

    @PostMapping(value = "/api/experiments/meow/visit", consumes = "application/json")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void visit(@Valid @RequestBody Visit visit) { stats.visit(visit.visitorId().toLowerCase(java.util.Locale.ROOT)); }

    @GetMapping("/api/admin/experiments/meow")
    MeowStatsService.Stats stats() { users.requireAdmin(); return stats.stats(); }
}
