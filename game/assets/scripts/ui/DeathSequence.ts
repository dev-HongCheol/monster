import { _decorator, Component, Node, tween, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 사망 시 "죽음 비트" 연출을 재생하는 컴포넌트. GameManager는 play(onComplete) 하나만 알고,
 * 연출이 무엇인지·얼마나 긴지는 이 컴포넌트가 소유한다 — 연출 교체·확장은 이 파일만 손대면 되고
 * GameManager(게임 flow/상태)는 불변이다. 지금 연출은 풀스크린 오버레이 페이드 하나다.
 */
@ccclass('DeathSequence')
export class DeathSequence extends Component {
  /** 화면을 덮는 풀스크린 오버레이(검은 Sprite). 평상시 투명(opacity 0), 죽음 비트에 불투명으로 채운다. */
  @property(Node) overlay: Node | null = null;
  /** 죽음 비트 길이(초) — 이 시간에 걸쳐 오버레이가 불투명해진 뒤 onComplete 호출. 연출 튜닝 노브. */
  @property fadeSec: number = 0.8;

  private _playing: boolean = false;
  private _overlayOpacity: UIOpacity | null = null;

  // 오버레이 UIOpacity를 확보해 0으로 낮춰 둔다 — 죽기 전 평상시에 검은 오버레이가 화면을 덮는 것을 막는다.
  onLoad() {
    if (this.overlay) {
      this._overlayOpacity =
        this.overlay.getComponent(UIOpacity) ?? this.overlay.addComponent(UIOpacity);
      if (this._overlayOpacity) this._overlayOpacity.opacity = 0;
    }
  }

  /**
   * 죽음 연출을 재생하고, 끝나면 onComplete를 호출한다(= 결과 씬 전환).
   * 오버레이를 fadeSec에 걸쳐 불투명하게 페이드해, 화면이 "정지"가 아니라 "전환"으로 읽히게 한다
   * (완전 정지 프레임은 렉/행과 구분이 안 되므로 지속적으로 변하는 모션을 준다). 오버레이가
   * 배선되지 않았으면 연출 없이 fadeSec만 흘려보낸 뒤 전환하는 폴백을 쓴다. 사망은 한 번뿐이지만
   * 중복 호출은 방어적으로 무시한다.
   * @param onComplete 연출 종료 후 실행할 콜백(씬 전환 등)
   */
  play(onComplete: () => void): void {
    if (this._playing) return;
    this._playing = true;

    const opacity = this._overlayOpacity;
    if (!opacity) {
      this.scheduleOnce(onComplete, this.fadeSec);
      return;
    }
    opacity.opacity = 0;
    tween(opacity).to(this.fadeSec, { opacity: 255 }).call(onComplete).start();
  }
}
