# ===== 빌드 스테이지: Vite 프로덕션 번들 생성 =====
FROM node:22-alpine AS build
WORKDIR /app

# 의존성 레이어 캐시 (lockfile 기반 재현 빌드)
COPY package.json package-lock.json ./
RUN npm ci

# 소스 복사 후 빌드 (tsc --noEmit + vite build)
COPY . .
RUN npm run build

# ===== 서빙 스테이지: 정적 파일을 nginx로 =====
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
