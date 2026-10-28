# =============================================
# 问田 — Dockerfile（后端镜像）
# =============================================
# 构建：
#   cd agri-weather-server
#   docker build -t agri-weather-server .
#
# 运行：
#   docker run -p 8082:8082 \
#     -e DB_URL=jdbc:mysql://host:3306/agri_weather \
#     -e DB_USER=agri_app \
#     -e DB_PASSWORD=你的密码 \
#     -e JWT_SECRET=你的JWT密钥 \
#     -e CORS_ORIGINS=https://你的域名.com \
#     agri-weather-server
# =============================================

# ---------- 阶段1：编译 ----------
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

# ---------- 阶段2：运行 ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 创建非 root 用户
RUN addgroup -S agri && adduser -S agri -G agri
USER agri

COPY --from=builder /build/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "/app/app.jar", "--spring.profiles.active=prod"]
