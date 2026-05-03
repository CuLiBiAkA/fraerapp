package com.fraergod.fraerapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class FraerappApplication {

	public static void main(String[] args) {
		SpringApplication.run(FraerappApplication.class, args);
	}

}
