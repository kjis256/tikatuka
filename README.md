# 티카투카 (Tikatuka)

로스트아크 인게임 미니게임 기반 1:1 주사위 배치 대전 웹게임. React + TypeScript + Vite. 모바일 반응형 지원.

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 단위 테스트
npm run build    # 프로덕션 번들 → dist/
```

## 컨테이너 배포

```bash
docker compose up -d            # http://localhost:8080
# 또는
docker build -t tikatuka:latest .
docker run -d -p 8080:80 --restart unless-stopped --name tikatuka tikatuka:latest
```
