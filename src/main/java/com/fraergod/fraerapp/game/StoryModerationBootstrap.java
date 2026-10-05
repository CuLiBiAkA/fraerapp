package com.fraergod.fraerapp.game;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
@Component @Order(20)
class StoryModerationBootstrap implements CommandLineRunner {
 private final StoryWorkflowService workflow;
 StoryModerationBootstrap(StoryWorkflowService workflow){this.workflow=workflow;}
 public void run(String... args){workflow.initializeExisting();}
}
