FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace
COPY gradlew gradlew.bat build.gradle settings.gradle ./
COPY gradle ./gradle
COPY auth-service ./auth-service
COPY src ./src
RUN chmod +x gradlew && ./gradlew :bootJar --no-daemon

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 spring && mkdir -p /data/uploads && chown -R spring:spring /app /data
COPY docker-entrypoint.sh /usr/local/bin/fraerapp-entrypoint
RUN chmod +x /usr/local/bin/fraerapp-entrypoint
COPY --from=build /workspace/build/libs/*.jar app.jar
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["fraerapp-entrypoint"]
