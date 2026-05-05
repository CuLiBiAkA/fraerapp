package com.fraergod.fraerapp.game;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface PlayerRepository extends JpaRepository<Player, String> {

	Optional<Player> findByUsernameIgnoreCase(String username);

	Optional<Player> findByUserId(String userId);
}
