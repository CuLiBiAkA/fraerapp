package com.fraergod.fraerapp.config;

import com.fraergod.fraerapp.game.StoryAssetStorageService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {

	private final StoryAssetStorageService assetStorage;
	private final String[] allowedOrigins;

	CorsConfig(StoryAssetStorageService assetStorage, @Value("${app.cors.allowed-origins}") String allowedOrigins) {
		this.assetStorage = assetStorage;
		this.allowedOrigins = java.util.Arrays.stream(allowedOrigins.split(","))
				.map(String::trim)
				.filter(origin -> !origin.isBlank())
				.toArray(String[]::new);
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(allowedOrigins)
				.allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
				.allowedHeaders("*")
				.allowCredentials(true);
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry.addResourceHandler(assetStorage.publicPathPattern())
				.addResourceLocations(assetStorage.rootPath().toUri().toString());
	}
}
