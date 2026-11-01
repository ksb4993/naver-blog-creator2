// ============================================
// 🤖 AI 네이버 블로그 자동 생성기 - 서버 (텍스트 전용)
// ============================================
//
// 이 파일은 Node.js 서버입니다.
// 이미지 없이 글만 생성하는 간단한 버전입니다!
//
// 주요 기능:
// 1. HTTP 서버 실행
// 2. HTML 파일 제공
// 3. 글 스타일 분석 API
// 4. 블로그 글 생성 API (텍스트만!)

// ============================================
// 📦 필요한 모듈 불러오기
// ============================================

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 🔐 환경 변수 로드
// ============================================

function loadEnv() {
  const env = {};
  try {
    const envPath = path.join(__dirname, '.env');
    const envFile = fs.readFileSync(envPath, 'utf8');

    envFile.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length) {
        env[key.trim()] = values.join('=').trim();
      }
    });
  } catch (err) {
    console.error('⚠️  .env 파일을 찾을 수 없습니다.');
  }
  return env;
}

const ENV = loadEnv();
const PORT = 3000;

// ============================================
// 🤖 OpenRouter API 호출
// ============================================
// Claude AI를 사용해서 글을 분석하고 생성합니다.

function callOpenRouter(messages, callback) {
  const apiKey = ENV.OPENROUTER_API_KEY;

  if (!apiKey) {
    callback(new Error('.env 파일에 OPENROUTER_API_KEY가 없습니다.'));
    return;
  }

  const requestBody = JSON.stringify({
    model: 'anthropic/claude-sonnet-4.5',
    messages: messages
  });

  const options = {
    hostname: 'openrouter.ai',
    port: 443,
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.error) {
          callback(new Error(response.error.message || 'API 에러'));
        } else {
          callback(null, response);
        }
      } catch (err) {
        callback(new Error('응답 파싱 실패: ' + err.message));
      }
    });
  });

  req.on('error', (err) => {
    callback(new Error('API 호출 실패: ' + err.message));
  });

  req.write(requestBody);
  req.end();
}

// ============================================
// 🌐 HTTP 서버
// ============================================

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ============================================
  // 📄 루트: HTML 파일 제공
  // ============================================
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    fs.readFile(path.join(__dirname, 'blog-index.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('파일을 찾을 수 없습니다.');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ============================================
  // 📝 API: 글 스타일 분석
  // ============================================
  if (parsedUrl.pathname === '/api/analyze-style' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { referencePosts } = JSON.parse(body);

        // TODO: AI한테 물어보기!
        //
        // 질문: "한국어 블로그 글의 스타일을 분석하는 프롬프트 만들어줘.
        //       반말/해요체/합니다체/한다체를 구분하고,
        //       소제목 개수, 문단 길이, 해시태그 개수도 분석해야 해.
        //       결과는 JSON 형식으로 받을 거야."
        //
        // JSON 형식:
        // {
        //   "tone": "반말/해요체/합니다체/한다체",
        //   "subheadings": "소제목 형태 (예: 3개, 이모지 사용)",
        //   "paragraphLength": "짧음/보통/길게",
        //   "hashtagCount": "5개",
        //   "introFormula": "도입부 패턴 예시",
        //   "closingFormula": "마무리 패턴 예시"
        // }

        const messages = [
          {
            role: 'user',
            content: `당신은 한국어 블로그 글 스타일 분석 전문가입니다.
아래 참고 글을 매우 상세하게 분석해서 다음 항목들을 JSON 형식으로 반환해주세요.

**분석 항목:**

1. **tone** (말투):
   - 정확한 말투 파악 (반말/해요체/합니다체/한다체)
   - 특징적인 종결어미 예시 포함
   - 예: "해요체 - '~해요', '~이에요', '~네요' 자주 사용"

2. **subheadings** (소제목):
   - 개수와 패턴을 구체적으로
   - 이모지 사용 여부와 위치
   - 소제목 길이와 형식
   - 예: "3~4개 사용, 각 소제목 앞에 이모지 배치, 짧고 명확한 체언형"

3. **paragraphLength** (문단 길이):
   - 평균 문장 개수
   - 한 문단의 대략적인 길이
   - 예: "짧음 - 문단당 2~3문장, 빠른 호흡"

4. **hashtagCount** (해시태그):
   - 정확한 개수
   - 예: "5~7개"

5. **introFormula** (도입부):
   - 첫 문장의 패턴
   - 독자를 끌어들이는 방식
   - 구체적인 예시 포함
   - 예: "질문으로 시작 - '혹시 ~하신 적 있나요?', '여러분은 ~인가요?' 등 독자에게 직접 질문하며 공감 유도"

6. **closingFormula** (마무리):
   - 마지막 문장/단락 패턴
   - 독자에게 전하는 메시지 방식
   - 구체적인 예시 포함
   - 예: "방문 유도 - '한번 방문해보세요!', '꼭 들러보시길!' 등 밝은 톤으로 권유하며 마무리"

**중요:**
- 각 항목마다 구체적인 예시와 특징을 포함할 것
- 단순히 "해요체" 대신 "해요체 - '~해요', '~거든요', '~더라구요' 등 친근한 어미 사용"처럼 상세히 작성
- 실제 글에서 발견되는 패턴을 정확하게 기술

참고 글:
${referencePosts}

JSON 형식 (반드시 이 형식으로만 반환):
{
  "tone": "해요체 - '~해요', '~이에요', '~네요' 자주 사용, 친근하고 따뜻한 느낌",
  "subheadings": "3~4개 사용, 각 소제목 앞에 이모지 배치, 짧고 명확한 체언형 (예: '🎯 핵심 포인트', '💡 꿀팁')",
  "paragraphLength": "짧음 - 문단당 2~3문장, 빠른 호흡으로 읽기 편하게 구성",
  "hashtagCount": "5~7개",
  "introFormula": "질문으로 시작 - '혹시 ~하신 적 있나요?', '여러분은 ~인가요?' 등 독자에게 직접 질문하며 공감 유도, 일상적인 경험을 언급하며 자연스럽게 주제로 이어감",
  "closingFormula": "방문 유도 - '한번 방문해보세요!', '꼭 들러보시길!' 등 밝은 톤으로 권유, 마지막에 위치/영업시간 등 실용정보 추가"
}`
          }
        ];

        callOpenRouter(messages, (err, response) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          try {
            const content = response.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const styleData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(styleData));
          } catch (parseErr) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'AI 응답 파싱 실패: ' + parseErr.message }));
          }
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '잘못된 요청' }));
      }
    });
    return;
  }

  // ============================================
  // ✨ API: 블로그 글 생성 (텍스트만)
  // ============================================
  if (parsedUrl.pathname === '/api/generate-post' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { keyword, style, storeInfo } = JSON.parse(body);

        // TODO: AI한테 물어보기!
        //
        // 질문: "네이버 블로그 글을 생성하는 프롬프트 만들어줘.
        //       키워드, 스타일, 가게 정보를 받아서
        //       제목, 본문, 해시태그를 JSON으로 반환해야 해.
        //       본문에는 **별표**로 소제목 표시해야 하고,
        //       분석된 스타일(말투, 문단 길이 등)을 정확히 따라야 해."
        //
        // JSON 형식:
        // {
        //   "title": "제목 (40자 이내)",
        //   "body": "본문 (마크다운 아님, **별표**만 사용)",
        //   "hashtags": ["태그1", "태그2", "태그3"]
        // }

        const messages = [
          {
            role: 'user',
            content: `당신은 네이버 블로그 글 작성 전문가입니다.
아래 정보를 바탕으로 블로그 글을 작성해주세요.

키워드: ${keyword}

가게 정보:
- 이름: ${storeInfo.name}
- 업종: ${storeInfo.type}
- 지역: ${storeInfo.location}
- 강조할 점: ${storeInfo.highlights}

글 스타일:
- 말투: ${style.tone}
- 소제목: ${style.subheadings}
- 문단 길이: ${style.paragraphLength}
- 해시태그 개수: ${style.hashtagCount}
- 도입부 패턴: ${style.introFormula}
- 마무리 패턴: ${style.closingFormula}

요구사항:
1. 제목은 40자 이내로 작성
2. 본문에는 **별표 두 개**로 소제목 강조 (마크다운 아님!)
3. 분석된 스타일의 말투를 정확히 따를 것
4. 문단 길이는 분석된 스타일에 맞출 것
5. 도입부와 마무리는 분석된 패턴을 따를 것
6. 해시태그는 분석된 개수만큼 생성

반드시 JSON만 반환하고 다른 설명은 넣지 마세요.

JSON 형식:
{
  "title": "제목 (40자 이내)",
  "body": "본문 (줄바꿈은 \\n 사용, 소제목은 **별표** 사용)",
  "hashtags": ["태그1", "태그2", "태그3"]
}`
          }
        ];

        callOpenRouter(messages, (err, response) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          try {
            const content = response.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const postData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(postData));
          } catch (parseErr) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'AI 응답 파싱 실패: ' + parseErr.message }));
          }
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: '잘못된 요청' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('페이지를 찾을 수 없습니다.');
});

// ============================================
// 🚀 서버 시작!
// ============================================
server.listen(PORT, () => {
  console.log(`\n🚀 네이버 블로그 글 생성기 (텍스트 전용) 시작!`);
  console.log(`📱 브라우저에서 열기: http://localhost:${PORT}`);
  console.log(`\n.env 파일 상태:`);
  console.log(`  - OPENROUTER_API_KEY: ${ENV.OPENROUTER_API_KEY ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`\n💡 이미지 생성도 하고 싶다면?`);
  console.log(`   → blog-server-with-image.js 사용하세요!`);
  console.log(`\n종료하려면 Ctrl+C를 누르세요.\n`);
});
