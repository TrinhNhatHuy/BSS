 package com.bss.backend_bss.dto;

 import jakarta.validation.constraints.*;
 import lombok.Data;

 @Data
 public class RegisterRequest {

     @NotBlank(message = "Username is required")
     @Size(min = 3, max = 50, message = "Username must be 3–50 characters")
     private String username;

     @NotBlank(message = "Email is required")
     @Email(message = "Must be a valid email address")
     private String email;

     @NotBlank(message = "Password is required")
     @Size(min = 8, message = "Password must be at least 8 characters")
     private String password;

     // Optional: if blank, username is used as display name
     private String displayName;
 }