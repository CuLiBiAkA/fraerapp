package com.fraergod.fraerapp.task;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
class TaskNotFoundException extends RuntimeException {
}
