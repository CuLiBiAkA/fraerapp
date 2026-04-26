package com.fraergod.fraerapp.game;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.UNAUTHORIZED)
class AdminRequiredException extends RuntimeException {
}
