# 티카투카 (Tikatuka)

로스트아크 인게임 미니게임 기반 1:1 주사위 배치 대전 웹게임. React + TypeScript + Vite. 모바일 반응형 지원.

> 📖 **코드/규칙/아키텍처 전체 명세는 [ARCHITECTURE.md](./ARCHITECTURE.md) 참고** — 다른 개발자·AI 에이전트가 코드베이스를 파악하기 위한 단일 문서(계층 구조·도메인 모델·공개 API·게임 규칙·기여 규칙).

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
