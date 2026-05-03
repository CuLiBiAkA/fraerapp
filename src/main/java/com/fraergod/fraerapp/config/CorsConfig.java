package com.fraergod.fraerapp.config;

import com.fraergod.fraerapp.game.StoryAssetStorageService;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {

	private final StoryAssetStorageService assetStorage;

	CorsConfig(StoryAssetStorageService assetStorage) {
		this.assetStorage = assetStorage;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins("*")
				.allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
				.allowedHeaders("*");
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		registry.addResourceHandler(assetStorage.publicPathPattern())
				.addResourceLocations(assetStorage.rootPath().toUri().toString());
	}
}
