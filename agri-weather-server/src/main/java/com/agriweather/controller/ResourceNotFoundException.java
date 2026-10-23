package com.agriweather.controller;

/** 资源不存在：由 ApiExceptionHandler 统一转成 404 + {error, message} */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}