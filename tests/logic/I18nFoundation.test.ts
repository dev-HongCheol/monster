import { beforeEach, describe, expect, it } from 'vitest';
import { type I18nCatalog, I18nLogic } from '../../game/assets/scripts/logic/I18nLogic';

/**
 * 소스(ko) 카탈로그는 키당 객체 `{ message, desc?, params? }`,
 * 타겟(en) 카탈로그는 순수 문자열 — t()는 둘 다 처리한다 (기획 § 3.1).
 */
const ko: I18nCatalog = {
  'result.victory': {
    message: '승리! {wave}웨이브 도달',
    desc: '승리 결과 화면',
    params: ['wave'],
  },
  'result.defeat': { message: '{wave}웨이브 도달', desc: '패배 결과 화면', params: ['wave'] },
  'hud.hp': { message: 'HP: {cur} / {max}', desc: '체력 라벨', params: ['cur', 'max'] },
  'card.add_magic': {
    message: '신규 마법 추가 ({category} · {tier}등급)',
    desc: '미보유 마법 합성 카드 설명',
    params: ['category', 'tier'],
  },
  'menu.play': '플레이',
};

const en: I18nCatalog = {
  'result.victory': 'Victory! Reached wave {wave}',
  'menu.play': 'PLAY',
  // result.defeat / hud.hp / card.add_magic 는 미번역 (키 누락)
  'result.defeat': '', // 빈 문자열 = 미번역 → ko 폴백 대상
};

describe('I18nLogic', () => {
  let i18n: I18nLogic;

  beforeEach(() => {
    i18n = new I18nLogic();
    i18n.setCatalog('ko', ko);
    i18n.setCatalog('en', en);
  });

  describe('lookup & 엔트리 형태', () => {
    it('기본 활성 언어는 ko다', () => {
      expect(i18n.activeLang).toBe('ko');
    });

    it('객체 엔트리는 .message를 추출한다', () => {
      expect(i18n.t('menu.play')).toBe('플레이');
    });

    it('문자열 엔트리는 그대로 반환한다 (en 활성)', () => {
      i18n.setLanguage('en');
      expect(i18n.t('menu.play')).toBe('PLAY');
    });
  });

  describe('파라미터 치환', () => {
    it('단일 {param}을 치환한다', () => {
      expect(i18n.t('result.defeat', { wave: 5 })).toBe('5웨이브 도달');
    });

    it('다중 {param}을 모두 치환한다', () => {
      expect(i18n.t('hud.hp', { cur: 80, max: 100 })).toBe('HP: 80 / 100');
    });

    it('params 미전달 시 토큰을 그대로 보존한다', () => {
      expect(i18n.t('result.defeat')).toBe('{wave}웨이브 도달');
    });

    it('누락된 param 토큰은 {name} 형태로 보존한다 (개발 신호)', () => {
      // category만 주고 tier 누락
      expect(i18n.t('card.add_magic', { category: '화염' })).toBe(
        '신규 마법 추가 (화염 · {tier}등급)',
      );
    });
  });

  describe('폴백 체인', () => {
    it('활성 언어(en)에 키 있으면 그 값을 쓴다', () => {
      i18n.setLanguage('en');
      expect(i18n.t('result.victory', { wave: 3 })).toBe('Victory! Reached wave 3');
    });

    it('활성 언어(en) 키 누락 → ko로 폴백한다', () => {
      i18n.setLanguage('en');
      // en에 hud.hp 없음 → ko 사용
      expect(i18n.t('hud.hp', { cur: 10, max: 20 })).toBe('HP: 10 / 20');
    });

    it('활성 언어(en) 빈 문자열 = 미번역 → ko로 폴백한다', () => {
      i18n.setLanguage('en');
      // en['result.defeat'] === '' → 미번역 취급, ko 폴백
      expect(i18n.t('result.defeat', { wave: 7 })).toBe('7웨이브 도달');
    });

    it('ko·en 모두 미스 → 키 자체를 반환한다', () => {
      expect(i18n.t('does.not.exist')).toBe('does.not.exist');
    });
  });

  describe('setLanguage', () => {
    it('활성 언어를 전환한다', () => {
      i18n.setLanguage('en');
      expect(i18n.activeLang).toBe('en');
    });
  });
});
