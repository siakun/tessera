/**
 * 프론트엔드 플러그인 레지스트리.
 *
 * 새 플러그인 추가 시 이 파일에 import 1줄 + 배열에 1줄 추가.
 * Core 코드(App.jsx 등)는 이 배열을 읽어 동적으로 탭을 구성한다.
 */
import githubSync from './github-sync'

const plugins = [
  githubSync,
  // 향후:
  // youtubeLikes,
  // youtubePlaylist,
  // nasEbook,
]

export default plugins
