# 다함께 차차차 (Web)

브라우저에서 즐기는 1인용 "다함께 차차차" 스타일 서바이벌 미니게임입니다.
방향키/WASD 또는 화면 터치·드래그로 캐릭터를 움직여, 불리는 숫자만큼 정확히
무리를 지어 살아남으세요. 생존자가 3명 이하로 줄어들면 승리합니다.

## 개발 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
npm run preview
```

React + HTML5 Canvas로 구현되어 있으며, 게임 로직은 `src/game/engine.js`,
렌더링/입력/루프는 `src/game/Game.jsx`에 있습니다.
