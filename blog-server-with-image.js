// ============================================
// 🤖 AI 네이버 블로그 자동 생성기 - 서버
// ============================================
//
// 이 파일은 Node.js 서버입니다.
// 웹 브라우저의 요청을 받아서 AI API를 호출하고 결과를 돌려줍니다.
//
// 주요 기능:
// 1. HTTP 서버 실행
// 2. HTML 파일 제공
// 3. 글 스타일 분석 API
// 4. 블로그 글 생성 API
// 5. 이미지 생성 API (Higgsfield)

// ============================================
// 📦 필요한 모듈 불러오기
// ============================================
// Node.js 기본 모듈만 사용합니다 (npm install 필요 없음!)

import http from 'http';        // HTTP 서버 만들기
import https from 'https';      // HTTPS 요청 보내기 (API 호출용)
import fs from 'fs';            // 파일 읽기/쓰기
import path from 'path';        // 파일 경로 다루기
import { fileURLToPath } from 'url';  // ES Module에서 __dirname 사용하기
import { URL } from 'url';      // URL 파싱

// ES Module에서 __dirname 만들기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 🔐 환경 변수 로드 (.env 파일)
// ============================================
// .env 파일에서 API 키를 읽어옵니다.
// 형식: KEY=VALUE

function loadEnv() {
  const env = {};
  try {
    const envPath = path.join(__dirname, '.env');
    const envFile = fs.readFileSync(envPath, 'utf8');

    // 한 줄씩 읽어서 파싱
    envFile.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length) {
        env[key.trim()] = values.join('=').trim();
      }
    });
  } catch (err) {
    console.error('⚠️  .env 파일을 찾을 수 없습니다. .env 파일을 생성해주세요.');
  }
  return env;
}

const ENV = loadEnv();
const PORT = 3000;

// ============================================
// 🤖 OpenRouter API 호출 (Claude AI)
// ============================================
// OpenRouter를 통해 Claude AI를 사용합니다.
// 글 스타일 분석과 블로그 글 생성에 사용됩니다.

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
// 🎨 Higgsfield 이미지 생성 (2단계)
// ============================================
// 1단계: 이미지 생성 요청 제출
// 2단계: 폴링으로 완성될 때까지 확인

function generateImage(prompt, callback) {
  const apiKey = ENV.HIGGSFIELD_API_KEY;

  if (!apiKey) {
    callback(new Error('.env 파일에 HIGGSFIELD_API_KEY가 없습니다.'));
    return;
  }

  // DRY_RUN 모드: 테스트용 더미 이미지 반환
  if (ENV.DRY_RUN === '1') {
    console.log(`[DRY_RUN] 이미지 생성 요청: ${prompt}`);
    setTimeout(() => {
      callback(null, 'https://via.placeholder.com/800x600?text=Test+Image');
    }, 500);
    return;
  }

  const requestBody = JSON.stringify({
    prompt: prompt,
    aspect_ratio: '4:3'
  });

  const options = {
    hostname: 'api.higgsfield.ai',
    port: 443,
    path: '/ideogram/v4.0',
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
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
          callback(new Error(response.error.message || 'Higgsfield API 에러'));
        } else if (response.request_id) {
          console.log(`이미지 생성 요청 제출: ${response.request_id}`);
          pollForResult(response.request_id, callback);
        } else {
          callback(new Error('request_id를 받지 못했습니다.'));
        }
      } catch (err) {
        callback(new Error('응답 파싱 실패: ' + err.message));
      }
    });
  });

  req.on('error', (err) => {
    callback(new Error('Higgsfield API 호출 실패: ' + err.message));
  });

  req.write(requestBody);
  req.end();
}

function pollForResult(requestId, callback, attempts = 0, maxAttempts = 60) {
  if (attempts >= maxAttempts) {
    callback(new Error('이미지 생성 타임아웃 (2분 초과)'));
    return;
  }

  const apiKey = ENV.HIGGSFIELD_API_KEY;

  const options = {
    hostname: 'api.higgsfield.ai',
    port: 443,
    path: `/requests/${requestId}/status`,
    method: 'GET',
    headers: {
      'Authorization': `Key ${apiKey}`
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

        if (response.status === 'completed' && response.images && response.images.length > 0) {
          console.log(`이미지 생성 완료: ${requestId}`);
          callback(null, response.images[0].url);
        } else if (response.status === 'failed') {
          callback(new Error('이미지 생성 실패'));
        } else {
          // 아직 완성 안 됨, 2초 후 재시도
          setTimeout(() => {
            pollForResult(requestId, callback, attempts + 1, maxAttempts);
          }, 2000);
        }
      } catch (err) {
        callback(new Error('폴링 응답 파싱 실패: ' + err.message));
      }
    });
  });

  req.on('error', (err) => {
    callback(new Error('폴링 실패: ' + err.message));
  });

  req.end();
}

// ============================================
// 🌐 HTTP 서버
// ============================================
// 웹 브라우저의 요청을 받아서 처리합니다.

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // CORS 설정 (브라우저에서 API 호출 가능하게)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ============================================
  // 📄 루트 경로: HTML 파일 제공
  // ============================================
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    // TODO: AI한테 물어보기!
    // "Node.js에서 HTML 파일 읽어서 보내는 방법은?"

    fs.readFile(path.join(__dirname, 'blog-index-with-image.html'), 'utf8', (err, data) => {
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
    // TODO: AI한테 물어보기!
    // "POST 요청에서 body 데이터 읽는 방법은?"
    // "한국어 말투 분석하는 프롬프트 만들어줘"

    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { referencePosts } = JSON.parse(body);

        // TODO: 스타일 분석 프롬프트 작성
        // - 말투 분석 (반말/존댓말/문어체)
        // - 소제목 스타일
        // - 문단 길이
        // - 사진 배치
        // - 해시태그 개수

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

4. **photoPlacement** (사진 배치):
   - 사진이 주로 어디에 배치되는지
   - 사진 개수 패턴
   - 예: "소제목마다 1~2장씩 배치, 본문 중간에도 추가"

5. **hashtagCount** (해시태그):
   - 정확한 개수
   - 예: "5~7개"

6. **introFormula** (도입부):
   - 첫 문장의 패턴
   - 독자를 끌어들이는 방식
   - 구체적인 예시 포함
   - 예: "질문으로 시작 - '혹시 ~하신 적 있나요?', '여러분은 ~인가요?' 등 독자에게 직접 질문하며 공감 유도"

7. **closingFormula** (마무리):
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
  "photoPlacement": "소제목마다 1~2장씩 배치, 본문 중간중간 설명과 함께 이미지 삽입",
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
  // ✨ API: 블로그 글 + 이미지 생성
  // ============================================
  if (parsedUrl.pathname === '/api/generate-post-with-image' && req.method === 'POST') {
    // TODO: AI한테 물어보기!
    // "블로그 글 생성하는 프롬프트 어떻게 만들어?"
    // "여러 이미지 동시에 생성하는 방법은?"

    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { keyword, style, storeInfo } = JSON.parse(body);

        // 1단계: 글 생성
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
- 사진 배치: ${style.photoPlacement || '소제목 아래'}
- 해시태그 개수: ${style.hashtagCount}
- 도입부 패턴: ${style.introFormula}
- 마무리 패턴: ${style.closingFormula}

요구사항:
1. 제목은 40자 이내로 작성
2. 본문에는 **별표 두 개**로 소제목 강조
3. 이미지가 들어갈 위치에 [IMAGE_PROMPT: 이미지 설명] 형식으로 표시 (2-3개)
4. 분석된 스타일의 말투를 정확히 따를 것
5. 이미지 프롬프트는 영어로 작성 (예: "Korean cafe interior, cozy atmosphere")

반드시 JSON만 반환하고 다른 설명은 넣지 마세요.

JSON 형식:
{
  "title": "제목",
  "body": "본문 (이미지 위치에 [IMAGE_PROMPT: ...] 포함)",
  "imagePrompts": ["English prompt 1", "English prompt 2"],
  "hashtags": ["태그1", "태그2", "태그3"]
}`
          }
        ];

        callOpenRouter(messages, (err, textResponse) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }

          try {
            const content = textResponse.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const postData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

            // 이미지 프롬프트가 있으면 이미지 생성
            if (postData.imagePrompts && postData.imagePrompts.length > 0) {
              let completedImages = 0;
              const imageUrls = [];

              postData.imagePrompts.forEach((prompt, index) => {
                generateImage(prompt, (imgErr, imageUrl) => {
                  if (imgErr) {
                    console.error(`이미지 ${index + 1} 생성 실패:`, imgErr.message);
                    imageUrls[index] = null;
                  } else {
                    imageUrls[index] = imageUrl;
                  }

                  completedImages++;

                  // 모든 이미지 생성 완료
                  if (completedImages === postData.imagePrompts.length) {
                    // [IMAGE_PROMPT: ...] 를 실제 이미지 URL로 교체
                    let finalBody = postData.body;
                    imageUrls.forEach((url, idx) => {
                      if (url) {
                        const regex = /\[IMAGE_PROMPT:[^\]]+\]/;
                        finalBody = finalBody.replace(regex, `[IMAGE:${url}]`);
                      }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                      title: postData.title,
                      body: finalBody,
                      images: imageUrls.filter(url => url !== null),
                      hashtags: postData.hashtags
                    }));
                  }
                });
              });
            } else {
              // 이미지 없는 경우
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({
                title: postData.title,
                body: postData.body,
                images: [],
                hashtags: postData.hashtags
              }));
            }

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

  // 404: 페이지를 찾을 수 없음
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('페이지를 찾을 수 없습니다.');
});

// ============================================
// 🚀 서버 시작!
// ============================================
server.listen(PORT, () => {
  console.log(`\n🚀 네이버 블로그 글 생성기 시작!`);
  console.log(`📱 브라우저에서 열기: http://localhost:${PORT}`);
  console.log(`🎨 이미지 생성: Higgsfield Ideogram v4.0`);
  console.log(`\n.env 파일 상태:`);
  console.log(`  - OPENROUTER_API_KEY: ${ENV.OPENROUTER_API_KEY ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`  - HIGGSFIELD_API_KEY: ${ENV.HIGGSFIELD_API_KEY ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`  - DRY_RUN: ${ENV.DRY_RUN === '1' ? '테스트 모드' : '실제 모드'}`);
  console.log(`\n종료하려면 Ctrl+C를 누르세요.\n`);
});
