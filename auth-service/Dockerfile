FROM gradle:8.14-jdk17 AS build
WORKDIR /workspace
COPY settings.gradle build.gradle gradlew ./
COPY gradle gradle
COPY auth-service auth-service
RUN ./gradlew :auth-service:bootJar --no-daemon

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/auth-service/build/libs/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
