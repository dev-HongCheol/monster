"""웹 빌드 폴더를 로컬에서 열어 보는 정적 서버. 모든 응답에 캐시 금지를 붙인다.

Cocos 웹 빌드는 `index.html`을 더블클릭해 `file://`로 열면 스크립트를 불러오지 못해 돌지 않으므로
웹 서버가 필요하다. 파이썬 기본 서버(`python -m http.server`)로 띄우면 Chrome이 이전 빌드의 js를
기억해 두었다가 다시 써서, 새로 빌드해도 고친 내용이 화면에 나오지 않는다. 그래서 응답마다
`Cache-Control: no-store`를 붙여 브라우저가 매번 새 파일을 받게 한다.

돌리는 법(레포 루트에서):
    Windows:  py -3 tools/web/serve_nocache.py game/build/<빌드 폴더> 8080
    macOS:    python3 tools/web/serve_nocache.py game/build/<빌드 폴더> 8080
포트를 빼면 8080이다. 끄려면 Ctrl+C.
"""

import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("사용법: serve_nocache.py <빌드 폴더> [포트]")
    root = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
    handler = functools.partial(NoCacheHandler, directory=root)
    print(f"http://localhost:{port}/ 에서 {root} 폴더를 연다")
    # 내 PC에서만 받는다. 빈 주소("")로 열면 같은 네트워크의 다른 기기도 폴더 목록과 파일을
    # 읽을 수 있어, 빌드 폴더 대신 레포를 잘못 넘기면 그대로 드러난다
    http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    main()
