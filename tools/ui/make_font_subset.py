"""UI 폰트 서브셋 도구 — 판정 화면 후보와 출시 폰트를 만든다.

실행 환경(이 판으로 만든 파일만 판정 결과와 같다고 본다):
  인터프리터  py — Python 3.12
  fonttools   4.67.0
  OTS 검사    opentype-sanitizer 9.2.0 (Chrome이 쓰는 폰트 검사를 미리 돌린다)

원본 폰트는 저장소에 넣지 않고 cloud-storage/fonts/source/ 아래에 둔다. 스크립트는 실행할 때마다
아래 SOURCES의 SHA-256과 파일을 대조하고, 어긋나면 실패 코드로 멈춘다 — 다른 판의 원본으로 만든
파일이 같은 검사 결과를 달고 나가는 일을 막기 위해서다.

  Pretendard 1.3.9
    https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip
    (zip SHA-256 04be351a74d6bf7d60c480a3087e51d185485d35a52023142af1df19eb8c428a)
    zip 안의 public/static/alternative/Pretendard-{Regular,Medium,ExtraBold}.ttf와 LICENSE.txt를
    source/pretendard-1.3.9/에 꺼내 둔다.
  Noto Sans KR (Google Fonts 가변 TTF, google/fonts 커밋 b38c5c93af322c45f633e17ac440ec1e6c94d489)
    https://raw.githubusercontent.com/google/fonts/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
    https://raw.githubusercontent.com/google/fonts/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/OFL.txt
    source/notosanskr-b38c5c9/에 둔다.

사용:
  후보 만들기   py tools/ui/make_font_subset.py --src cloud-storage/fonts/source --out game/assets/resources/fonts
                두 후보에 A · B를 무작위로 붙여 UiSansA-<굵기>.ttf · UiSansB-<굵기>.ttf 여섯 파일을 만든다.
                A · B가 어느 폰트인지 적은 대응표는 cloud-storage/fonts/probe-map.json(저장소 밖)에 두고,
                이미 있으면 그 배정을 다시 쓴다.
                터미널에는 「검사 통과」만 찍는다 — 파일 크기와 예약 이름 목록은 원본 폰트를 드러낸다.
  최종 이름     ... --final A --weights 500,800 --name UiSans
                이긴 후보 하나만 UiSans-<굵기>.ttf로 다시 만들고, 판정한 후보 파일과 글리프 표가 바이트 단위로
                같은지 검사한다(자체 검사 7). 기록은 tools/ui/font-subset-report.json, 고지는 licenses/OFL.txt ·
                NOTICE.txt다. 후보 파일이 있어야 돌므로 판정 직후 한 번만 쓴다.
  다시 만들기   ... --rebuild notosanskr --weights 500,800 --name UiSans
                판정이 끝나 후보 파일과 대응표 없이 최종 파일을 다시 만든다(글자 목록을 바꿀 때 등). 판정 뒤에는
                후보 파일을 지웠으므로 --final은 검사 7에서 멈춘다. 그렇다고 후보 만들기를 다시 돌리면 후보
                이름의 TTF 여섯과 고지 넷이 resources/fonts와 licenses 폴더에 다시 생기는데, git은 그것을 막지
                않는다 — 후보 파일은 어느 커밋에도 넣지 않기로 했다. 그래서 이 경로는 이긴 원본을 이름(SOURCES의
                키)으로 받고, 검사 7은 건너뛴 사유를 보고 파일에 남긴다. 글자 목록이 바뀌면 글리프 표가 달라져
                검사 7은 원리상 통과할 수 없고, 이 경로의 근거는 나머지 검사와 판정 기록이다.
  숫자 전용     ... --final A --weights 500 --name UiSansDigits --digits-only
                숫자와 기호만 담고 고정 폭 숫자를 기본 숫자에 배정한 작은 파일. 문장 속 고정 폭 숫자를 받아들일
                수 없다고 판정했을 때만 쓰고, 그때 본문 최종 파일은 --no-bake로 굽지 않는다. --rebuild와도 쓴다.

자체 검사(하나라도 어긋나면 실패 코드로 멈춘다):
  1. 숫자 0~9의 advance 폭이 모두 같고, GPOS kern(옛 kern 표 포함)에 숫자 · 콜론끼리의 간격 조정이 없다.
     advance가 같아도 글자 짝마다 간격을 조정하면 11:11과 00:00의 폭이 다시 달라진다.
  2. 이름 표의 모든 레코드(0 · 13 · 14 제외)와 파일 이름에 예약 이름(OFL Reserved Font Name)이 없다.
  3. 글자 목록의 모든 코드포인트가 cmap에 있다.
  4. 이름 칸 0(저작권) · 13(라이선스 설명) · 14(라이선스 주소)가 남아 있다.
  5. 출력 파일 이름이 서로 다르고 ASCII 영문 · 숫자 · -만 쓴다. 엔진은 같은 글꼴 이름이 이미 등록돼 있으면
     새 파일을 불러오지 않고 앞서 등록된 것을 그대로 쓴다.
  6. 다른 표(STAT · fvar · GSUB/GPOS 기능 매개변수)가 가리키는 이름 칸이 모두 남아 있다. 가리키는 이름이 끊긴
     폰트는 Chrome의 OTS가 표를 버리거나 폰트를 거부할 수 있고, 거부되면 조용히 대체 글꼴로 그려진다.
  7. (--final) 글리프 관련 표(glyf · loca · hmtx · cmap · GSUB · GPOS · OS/2)가 판정한 후보 파일과 같다.
     --rebuild에서는 비교할 후보가 없어 건너뛰고, 사유를 보고 파일에 적는다.
  8. OTS가 폰트를 받아들인다.
  가변 폰트에서 뽑은 굵기는 겹친 윤곽 플래그가 남아 있는지도 본다 — 빠지면 Android 브라우저(FreeType)에서
  겹친 획이 하얗게 비어 보일 수 있다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import ots
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple
from fontTools.varLib import instancer

# ---------------------------------------------------------------------------
# 원본
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Source:
    """원본 폰트 하나. files는 굵기 → 파일 이름(가변 폰트면 모든 굵기가 같은 파일)."""

    key: str
    folder: str
    display: str
    files: dict[int, str]
    license: str
    variable: bool
    sha256: dict[str, str] = field(default_factory=dict)


SOURCES: dict[str, Source] = {
    "pretendard": Source(
        key="pretendard",
        folder="pretendard-1.3.9",
        display="Pretendard 1.3.9",
        files={400: "Pretendard-Regular.ttf", 500: "Pretendard-Medium.ttf", 800: "Pretendard-ExtraBold.ttf"},
        license="LICENSE.txt",
        variable=False,
        sha256={
            "Pretendard-Regular.ttf": "6d0af5258997aec7354a6e340fc2325ba321c410ca48b3af858c8c3d6e92a324",
            "Pretendard-Medium.ttf": "3bae579377eb8e9ac412cb4809ebc3de1d956ed75995c1e346f0c1311053f4e2",
            "Pretendard-ExtraBold.ttf": "eedbd2877218242323bdff816684f7f5c325e54ae820d5b78eec9a5e5c7edef6",
            "LICENSE.txt": "b04538c9abec39a3db75108cf0af0fd9c77032fe8aa2cf38345b4d250e98e38e",
        },
    ),
    "notosanskr": Source(
        key="notosanskr",
        folder="notosanskr-b38c5c9",
        display="Noto Sans KR (google/fonts b38c5c9)",
        files={400: "NotoSansKR[wght].ttf", 500: "NotoSansKR[wght].ttf", 800: "NotoSansKR[wght].ttf"},
        license="OFL.txt",
        variable=True,
        sha256={
            "NotoSansKR[wght].ttf": "194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252",
            "OFL.txt": "1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9",
        },
    ),
}

# 판정 화면 후보의 굵기 — 본문 400 · 500, 제목 800
CANDIDATE_WEIGHTS = (400, 500, 800)
WEIGHT_NAMES = {400: "Regular", 500: "Medium", 800: "ExtraBold"}

HINT_TABLES = ("fpgm", "prep", "cvt ", "gasp")
# 남기는 이름 칸 — 저작권 · 이름 1~6 · 라이선스 설명 · 주소 · 원본에 있으면 16 · 17(다른 표가 가리키는 칸은
# fontTools가 따로 남긴다)
KEEP_NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
# 예약 이름 검사에서 빼는 칸 — 저작권 · 라이선스 문구는 원래 이름을 적어야 하는 자리다
LICENSE_NAME_IDS = {0, 13, 14}
# 숫자 · 콜론끼리 간격 조정을 보는 글자
DIGITS = "0123456789"
DIGITS_ONLY_CHARS = "0123456789:,.%+-/ "
STEM_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")
GLYPH_TABLES = ("glyf", "loca", "hmtx", "cmap", "GSUB", "GPOS", "OS/2")
OVERLAP_COMPOUND = 0x0400

REPO = Path(__file__).resolve().parents[2]
DEFAULT_MAP = REPO / "cloud-storage" / "fonts" / "probe-map.json"
DEFAULT_CANDIDATE_REPORT = REPO / "cloud-storage" / "fonts" / "candidate-report.json"
DEFAULT_FINAL_REPORT = REPO / "tools" / "ui" / "font-subset-report.json"
DEFAULT_LICENSES = REPO / "game" / "build-templates" / "web-mobile" / "licenses"


class Stop(Exception):
    """검사 실패 — 실패 코드로 멈춘다."""


# ---------------------------------------------------------------------------
# 글자 목록
# ---------------------------------------------------------------------------


def ks_x_1001_hangul() -> list[int]:
    """KS X 1001 완성형 한글 2,350자. EUC-KR의 0xB0A1~0xC8FE가 그 자리다."""
    chars: list[int] = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            chars.append(ord(bytes([hi, lo]).decode("euc_kr")))
    if len(chars) != 2350:
        raise Stop(f"KS X 1001 한글이 2,350자가 아니다({len(chars)}자)")
    return chars


def body_codepoints() -> list[int]:
    """본문 폰트의 글자 — 한글 2,350자 + ASCII 95자 + 가운뎃점."""
    return ks_x_1001_hangul() + list(range(0x20, 0x7F)) + [0x00B7]


# ---------------------------------------------------------------------------
# 원본 확인 · 예약 이름
# ---------------------------------------------------------------------------


def verify_sources(src_root: Path, sources: list[Source]) -> None:
    """원본 파일의 SHA-256이 이 스크립트에 적힌 값과 같은지 본다."""
    for s in sources:
        for name, want in s.sha256.items():
            path = src_root / s.folder / name
            if not path.is_file():
                raise Stop(f"원본이 없다: {path}")
            got = hashlib.sha256(path.read_bytes()).hexdigest()
            if got != want:
                raise Stop(f"원본 SHA-256이 다르다: {path} (적힌 값 {want[:12]}…, 실제 {got[:12]}…)")


def reserved_names(license_path: Path) -> tuple[list[str], list[str]]:
    """OFL 머리말에서 저작권 줄과 예약 이름을 읽는다. 머리말을 읽지 못하면 멈춘다."""
    text = license_path.read_text(encoding="utf-8")
    head, sep, _ = text.partition("This Font Software is licensed under the SIL Open Font License")
    if not sep:
        raise Stop(f"OFL 머리말을 읽지 못했다: {license_path}")
    copyright_lines = [ln.strip() for ln in head.strip().splitlines() if ln.strip()]
    names: list[str] = []
    for m in re.finditer(r"Reserved Font Names?\s+(.+?)(?:\.\s*$|$)", head, flags=re.MULTILINE):
        quoted = re.findall(r"[\"'“‘]([^\"'”’]+)[\"'”’]", m.group(1))
        names.extend(quoted if quoted else [m.group(1).strip().rstrip(".,")])
    return copyright_lines, names


# ---------------------------------------------------------------------------
# 만들기
# ---------------------------------------------------------------------------


def hinting_state(font: TTFont) -> tuple[bool, ...]:
    return tuple(t in font for t in HINT_TABLES)


def load_weight(src_root: Path, s: Source, weight: int) -> TTFont:
    """원본에서 한 굵기를 연다. 가변 폰트면 정적 인스턴스를 뽑는다(겹친 윤곽 플래그는 instancer 기본값대로 켠다)."""
    font = TTFont(src_root / s.folder / s.files[weight])
    if s.variable:
        font = instancer.instantiateVariableFont(font, {"wght": weight}, static=True)
    # 정적 폰트의 STAT는 가리킬 축이 없어 쓸모가 없고, 남겨 두면 끊긴 이름 칸을 가리킬 수 있다(검사 6)
    if "fvar" not in font and "STAT" in font:
        del font["STAT"]
    font["OS/2"].usWeightClass = weight
    return font


def tnum_mapping(font: TTFont) -> dict[str, str]:
    """GSUB tnum의 치환표. 단일 치환이 아니면 멈춘다 — 그때는 타이머 숫자만 다른 폰트를 쓸지 다시 정한다."""
    if "GSUB" not in font:
        return {}
    gsub = font["GSUB"].table
    mapping: dict[str, str] = {}
    for fr in gsub.FeatureList.FeatureRecord:
        if fr.FeatureTag != "tnum":
            continue
        for li in fr.Feature.LookupListIndex:
            lookup = gsub.LookupList.Lookup[li]
            for st in lookup.SubTable:
                kind, sub = lookup.LookupType, st
                if kind == 7:
                    kind, sub = st.ExtSubTable.LookupType, st.ExtSubTable
                if kind != 1:
                    raise Stop(f"tnum이 단일 치환이 아니다(lookup {li} 형식 {kind})")
                mapping.update(sub.mapping)
    return mapping


def bake_tnum(font: TTFont) -> bool:
    """tnum 치환을 cmap에 써서 기본 숫자 0~9가 고정 폭 모양을 가리키게 한다. Cocos 웹 빌드는 tnum을 켤 방법이 없다."""
    mapping = tnum_mapping(font)
    if not mapping:
        return False
    baked = False
    for table in font["cmap"].tables:
        if not table.isUnicode():
            continue
        for ch in DIGITS:
            glyph = table.cmap.get(ord(ch))
            if glyph in mapping:
                table.cmap[ord(ch)] = mapping[glyph]
                baked = True
    return baked


def rename(font: TTFont, family: str, weight: int) -> None:
    """남은 이름 레코드를 플랫폼 · 언어와 상관없이 모두 새 이름으로 바꾼다. 원래 이름이 남으면 이름 가리기와 예약 이름 제한이 함께 깨진다."""
    wname = WEIGHT_NAMES[weight]
    values = {
        1: family if weight == 400 else f"{family} {wname}",
        2: "Regular",
        3: f"{family}-{wname};subset",
        4: f"{family} {wname}",
        6: f"{family}-{wname}",
        16: family,
        17: wname,
    }
    name = font["name"]
    present = {r.nameID for r in name.names}
    for rec in name.names:
        if rec.nameID in values:
            rec.string = values[rec.nameID]
    for nid in (1, 2, 3, 4, 6):
        if nid not in present:
            name.setName(values[nid], nid, 3, 1, 0x409)


def build_one(
    src_root: Path,
    s: Source,
    weight: int,
    out_path: Path,
    family: str,
    codepoints: list[int],
    no_hinting: bool,
    bake: bool,
) -> dict:
    """한 굵기를 서브셋해 저장하고, 만든 과정의 기록을 돌려준다."""
    font = load_weight(src_root, s, weight)
    baked = bake_tnum(font) if bake else False
    opts = subset.Options()
    opts.layout_features = list(opts.layout_features) + ["tnum"]
    opts.name_IDs = KEEP_NAME_IDS
    if no_hinting:
        opts.hinting = False
        # gasp도 뺀다 — 힌팅 표가 없는 쪽에 맞추는 것이라, gasp가 남으면 Windows가 작은 크기에서 두 후보를
        # 다른 방식으로 그려 판정이 폰트가 아니라 그리기 설정을 비교하게 된다
        opts.drop_tables = list(opts.drop_tables) + ["gasp"]
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=codepoints)
    sub.subset(font)
    rename(font, family, weight)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    font.save(out_path)
    return {"weight": weight, "baked": baked, "hinting": "removed" if no_hinting else "kept"}


# ---------------------------------------------------------------------------
# 검사
# ---------------------------------------------------------------------------


def _nonzero(value) -> bool:
    return value is not None and any(getattr(value, a, 0) for a in ("XPlacement", "YPlacement", "XAdvance", "YAdvance"))


def check_digits(font: TTFont) -> None:
    """검사 1 — 숫자 폭이 같고 숫자 · 콜론끼리 간격 조정이 없다."""
    cmap = font.getBestCmap()
    digits = [cmap[ord(c)] for c in DIGITS]
    advances = {font["hmtx"][g][0] for g in digits}
    if len(advances) != 1:
        raise Stop(f"검사 1: 숫자 advance 폭이 다르다({sorted(advances)})")
    targets = set(digits) | ({cmap[ord(":")]} if ord(":") in cmap else set())
    if "GPOS" in font:
        gpos = font["GPOS"].table
        kern_lookups = {
            li for fr in gpos.FeatureList.FeatureRecord if fr.FeatureTag == "kern" for li in fr.Feature.LookupListIndex
        }
        for li in kern_lookups:
            lookup = gpos.LookupList.Lookup[li]
            for st in lookup.SubTable:
                kind, sub = lookup.LookupType, st
                if kind == 9:
                    kind, sub = st.ExtSubTable.LookupType, st.ExtSubTable
                if kind != 2:
                    continue
                if sub.Format == 1:
                    for i, left in enumerate(sub.Coverage.glyphs):
                        if left not in targets:
                            continue
                        for pvr in sub.PairSet[i].PairValueRecord:
                            if pvr.SecondGlyph in targets and (_nonzero(pvr.Value1) or _nonzero(pvr.Value2)):
                                raise Stop(f"검사 1: GPOS kern이 {left}–{pvr.SecondGlyph} 간격을 조정한다")
                else:
                    covered = set(sub.Coverage.glyphs)
                    for left in targets & covered:
                        c1 = sub.ClassDef1.classDefs.get(left, 0)
                        for right in targets:
                            c2 = sub.ClassDef2.classDefs.get(right, 0)
                            rec = sub.Class1Record[c1].Class2Record[c2]
                            if _nonzero(rec.Value1) or _nonzero(rec.Value2):
                                raise Stop(f"검사 1: GPOS kern이 {left}–{right} 간격을 조정한다")
    if "kern" in font:
        for table in font["kern"].kernTables:
            for (left, right), v in table.kernTable.items():
                if left in targets and right in targets and v:
                    raise Stop(f"검사 1: kern 표가 {left}–{right} 간격을 조정한다")


def check_reserved(font: TTFont, stem: str, reserved: list[str]) -> None:
    """검사 2 — 이름 레코드(0 · 13 · 14 제외)와 파일 이름에 예약 이름이 없다."""
    for rn in reserved:
        low = rn.lower()
        if low in stem.lower():
            raise Stop("검사 2: 파일 이름에 예약 이름이 있다")
        for rec in font["name"].names:
            if rec.nameID in LICENSE_NAME_IDS:
                continue
            if low in rec.toUnicode().lower():
                raise Stop(f"검사 2: 이름 칸 {rec.nameID}에 예약 이름이 있다")


def check_cmap(font: TTFont, codepoints: list[int]) -> None:
    """검사 3 — 글자 목록이 모두 cmap에 있다."""
    cmap = font.getBestCmap()
    missing = [cp for cp in codepoints if cp not in cmap]
    if missing:
        raise Stop(f"검사 3: cmap에 없는 글자 {len(missing)}개(첫 글자 U+{missing[0]:04X})")


def check_license_names(font: TTFont) -> None:
    """검사 4 — 이름 칸 0 · 13 · 14가 남아 있다."""
    present = {r.nameID for r in font["name"].names}
    lost = sorted(LICENSE_NAME_IDS - present)
    if lost:
        raise Stop(f"검사 4: 이름 칸 {lost}이 없다")


def check_stems(stems: list[str]) -> None:
    """검사 5 — 출력 파일 이름이 서로 다르고 ASCII 영문 · 숫자 · -만 쓴다."""
    if len(set(stems)) != len(stems):
        raise Stop("검사 5: 출력 파일 이름이 겹친다")
    bad = [s for s in stems if not STEM_PATTERN.match(s)]
    if bad:
        raise Stop(f"검사 5: 파일 이름에 쓸 수 없는 글자가 있다({bad[0]})")


def check_referenced_names(font: TTFont) -> None:
    """검사 6 — 다른 표가 가리키는 이름 칸이 모두 남아 있다."""
    visitor = subset.NameRecordVisitor()
    visitor.visit(font)
    present = {r.nameID for r in font["name"].names}
    lost = sorted(set(visitor.seen) - present)
    if lost:
        raise Stop(f"검사 6: 다른 표가 가리키는 이름 칸 {lost}이 없다")


def check_same_glyph_tables(final_path: Path, candidate_path: Path) -> None:
    """검사 7 — 최종 파일의 글리프 관련 표가 판정한 후보 파일과 바이트 단위로 같다."""
    if not candidate_path.is_file():
        raise Stop(f"검사 7: 비교할 후보 파일이 없다({candidate_path.name})")
    a, b = TTFont(final_path), TTFont(candidate_path)
    for tag in GLYPH_TABLES:
        if (tag in a) != (tag in b) or (tag in a and a.getTableData(tag) != b.getTableData(tag)):
            raise Stop(f"검사 7: {tag} 표가 판정한 후보와 다르다")


def check_overlap_flags(font: TTFont) -> None:
    """가변 폰트에서 뽑은 굵기 — 윤곽이 있는 모든 글리프에 겹친 윤곽 플래그가 남아 있다."""
    glyf = font["glyf"]
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.isComposite():
            if not g.components[0].flags & OVERLAP_COMPOUND:
                raise Stop(f"겹친 윤곽 플래그가 빠졌다({name})")
        elif g.numberOfContours > 0 and not g.flags[0] & flagOverlapSimple:
            raise Stop(f"겹친 윤곽 플래그가 빠졌다({name})")


def check_ots(path: Path) -> None:
    """검사 8 — OTS(Chrome의 폰트 검사)가 받아들인다."""
    result = ots.sanitize(str(path), capture_output=True, text=True)
    if result.returncode != 0:
        raise Stop(f"검사 8: OTS가 거부했다({path.name}): {(result.stderr or result.stdout).strip()[:200]}")


def run_checks(path: Path, codepoints: list[int], reserved: list[str], from_variable: bool) -> None:
    font = TTFont(path)
    check_digits(font)
    check_reserved(font, path.stem, reserved)
    check_cmap(font, codepoints)
    check_license_names(font)
    check_referenced_names(font)
    if from_variable:
        check_overlap_flags(font)
    check_ots(path)


# ---------------------------------------------------------------------------
# 기록 · 고지
# ---------------------------------------------------------------------------


def file_record(path: Path) -> dict:
    data = path.read_bytes()
    return {"file": path.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def write_notice(
    src_root: Path, out_dir: Path, prefix: str, s: Source, family: str, copyright_lines: list[str], mods: list[str]
) -> None:
    """OFL 원문과 NOTICE를 둔다. Cocos는 build-templates 폴더의 파일을 빌드 결과물에 그대로 복사한다."""
    out_dir.mkdir(parents=True, exist_ok=True)
    license_text = (src_root / s.folder / s.license).read_text(encoding="utf-8")
    (out_dir / f"{prefix}OFL.txt").write_text(license_text, encoding="utf-8")
    notice = [
        f"{family} — font bundled with this game",
        "",
        f"{family} is a Modified Version of {s.display}, licensed under the SIL Open Font License, Version 1.1.",
        "The full license text is in OFL.txt next to this file.",
        "",
        "Original copyright:",
        *[f"  {ln}" for ln in copyright_lines],
        "",
        "Modifications:",
        *[f"  - {m}" for m in mods],
        "",
    ]
    (out_dir / f"{prefix}NOTICE.txt").write_text("\n".join(notice), encoding="utf-8")


def modifications(s: Source, weights: list[int], baked: bool, no_hinting: bool, family: str, digits_only: bool) -> list[str]:
    mods = [
        "Subset to digits and number symbols only" if digits_only else "Subset to KS X 1001 Hangul (2,350 syllables), ASCII and the middle dot",
    ]
    if s.variable:
        mods.append(f"Static instances extracted from the variable font (wght {', '.join(map(str, weights))})")
    if baked:
        mods.append("Tabular figures assigned to the default digits")
    if no_hinting:
        mods.append("Hinting removed")
    # 예약 이름 조항이 이름을 바꾸게 하는 것은 원본 이름에 예약 이름이 든 경우뿐이다(Noto Sans KR의 예약 이름
    # 「Source」는 원래 이름에 없다). 이 도구는 이름을 가린 판정 뒤 중립 이름 하나로 내보내려고 언제나
    # 바꾸므로, 조항이 요구했다고 적지 않는다 — 적으면 다음 사람이 「이 폰트는 이름을 꼭 바꿔야 한다」로 읽는다
    mods.append(f'Renamed to "{family}"')
    return mods


# ---------------------------------------------------------------------------
# 실행
# ---------------------------------------------------------------------------

def load_or_assign_map(map_path: Path) -> dict[str, str]:
    """A · B 배정. 이미 있으면 그대로 쓴다 — 다시 섞으면 사용자가 본 열과 파일이 어긋난다."""
    if map_path.is_file():
        data = json.loads(map_path.read_text(encoding="utf-8"))
        if sorted(data) == ["A", "B"] and sorted(data.values()) == sorted(SOURCES):
            return data
        raise Stop(f"대응표 형식이 틀렸다: {map_path}")
    keys = list(SOURCES)
    random.SystemRandom().shuffle(keys)
    data = {"A": keys[0], "B": keys[1]}
    map_path.parent.mkdir(parents=True, exist_ok=True)
    map_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return data


def decide_hinting(src_root: Path) -> bool:
    """두 후보의 힌팅 상태가 다르면 True(둘 다 힌팅을 뺀다). 최종 이름으로 다시 만들 때도 같은 선택을 쓴다(판정한 것 = 내보내는 것)."""
    states = {hinting_state(load_weight(src_root, s, 400)) for s in SOURCES.values()}
    return len(states) > 1


def run_candidates(args) -> None:
    mapping = load_or_assign_map(args.map)
    no_hinting = decide_hinting(args.src)
    codepoints = body_codepoints()
    report = {"createdAt": _now(), "noHinting": no_hinting, "candidates": {}}
    stems: list[str] = []
    for label, key in sorted(mapping.items()):
        s = SOURCES[key]
        family = f"UiSans{label}"
        copyright_lines, reserved = reserved_names(args.src / s.folder / s.license)
        files = []
        baked_any = False
        for w in CANDIDATE_WEIGHTS:
            out = args.out / f"{family}-{w}.ttf"
            info = build_one(args.src, s, w, out, family, codepoints, no_hinting, bake=True)
            baked_any = baked_any or info["baked"]
            run_checks(out, codepoints, reserved, s.variable)
            stems.append(out.stem)
            files.append({**info, **file_record(out)})
        write_notice(
            args.src,
            args.licenses,
            f"{family}-",
            s,
            family,
            copyright_lines,
            modifications(s, list(CANDIDATE_WEIGHTS), baked_any, no_hinting, family, False),
        )
        report["candidates"][label] = {"source": s.display, "reservedNames": reserved, "files": files}
    check_stems(stems)
    args.candidate_report.parent.mkdir(parents=True, exist_ok=True)
    args.candidate_report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # 크기 · 예약 이름 · 원본 이름은 찍지 않는다 — 원본 폰트를 드러내 이름 가리기를 깬다
    print(f"검사 통과 — 후보 파일 {len(stems)}개")


def run_final(args) -> None:
    """최종 이름으로 만든다. --final은 판정 직후(후보 파일과 대응표로), --rebuild는 판정 뒤(원본 키로) 쓴다."""
    if args.rebuild:
        s = SOURCES[args.rebuild]
    else:
        # --final만 대응표를 읽는다 — 대응표가 없으면 load_or_assign_map이 새로 섞어 엉뚱한 원본을 고를 수 있다
        mapping = load_or_assign_map(args.map)
        if args.final not in mapping:
            raise Stop("--final은 A 또는 B다")
        s = SOURCES[mapping[args.final]]
    no_hinting = decide_hinting(args.src)
    weights = [int(w) for w in args.weights.split(",")]
    codepoints = [ord(c) for c in DIGITS_ONLY_CHARS] if args.digits_only else body_codepoints()
    copyright_lines, reserved = reserved_names(args.src / s.folder / s.license)
    bake = args.digits_only or not args.no_bake
    files = []
    stems = []
    baked_any = False
    for w in weights:
        out = args.out / f"{args.name}-{w}.ttf"
        info = build_one(args.src, s, w, out, args.name, codepoints, no_hinting, bake=bake)
        baked_any = baked_any or info["baked"]
        run_checks(out, codepoints, reserved, s.variable)
        if args.digits_only or args.no_bake:
            # 판정한 후보와 글자 목록 · 숫자 배정이 달라 글리프 표가 같을 수 없다 — 이 경로의 근거는 4번 줄 판정이다
            info["check7"] = "skipped: digits-only or no-bake"
        elif args.rebuild:
            # 판정 뒤라 비교할 후보 파일이 없고, 글자 목록을 바꿨다면 글리프 표도 달라진다 — 근거는 나머지 검사와 판정 기록이다
            info["check7"] = "skipped: rebuild after judgment (candidate files deleted)"
        else:
            check_same_glyph_tables(out, args.out / f"UiSans{args.final}-{w}.ttf")
            info["check7"] = "passed"
        stems.append(out.stem)
        files.append({**info, **file_record(out)})
    check_stems(stems)
    prefix = "" if not args.digits_only else f"{args.name}-"
    write_notice(
        args.src,
        args.licenses,
        prefix,
        s,
        args.name,
        copyright_lines,
        modifications(s, weights, baked_any, no_hinting, args.name, args.digits_only),
    )
    report_path = args.final_report if not args.digits_only else args.final_report.with_name(f"{args.name}-report.json")
    record = {
        "createdAt": _now(),
        "source": s.display,
        "sourceSha256": s.sha256,
        "reservedNames": reserved,
        "reservedNamesCheckedAt": _now()[:10],
        "noHinting": no_hinting,
        "tools": {"python": sys.version.split()[0], "fonttools": _version("fontTools"), "otsSanitizer": _version("ots")},
        "files": files,
        "totalBytes": sum(f["bytes"] for f in files),
    }
    report_path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2, ensure_ascii=False))


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _version(module: str) -> str:
    from importlib.metadata import version

    return version({"fontTools": "fonttools", "ots": "opentype-sanitizer"}[module])


def main() -> int:
    # Windows 터미널의 기본 인코딩(cp949)으로는 줄표 같은 글자를 찍다가 멈춘다
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description="UI 폰트 서브셋 도구")
    p.add_argument("--src", type=Path, required=True, help="원본 폴더(cloud-storage/fonts/source)")
    p.add_argument("--out", type=Path, required=True, help="출력 폴더(game/assets/resources/fonts)")
    p.add_argument("--final", choices=["A", "B"], help="이긴 후보를 최종 이름으로 다시 만든다(판정 직후)")
    p.add_argument("--rebuild", choices=sorted(SOURCES), help="판정 뒤 이긴 원본으로 최종 파일을 다시 만든다(검사 7 건너뜀)")
    p.add_argument("--weights", default="500,800", help="--final · --rebuild의 굵기(쉼표) — 기본은 판정한 본문 500 · 제목 800")
    p.add_argument("--name", default="UiSans", help="--final · --rebuild의 가족 이름")
    p.add_argument("--digits-only", action="store_true", help="숫자 전용 파일을 만든다(--final · --rebuild와 함께)")
    p.add_argument("--no-bake", action="store_true", help="본문 최종 파일에 고정 폭 숫자를 굽지 않는다")
    p.add_argument("--map", type=Path, default=DEFAULT_MAP)
    p.add_argument("--licenses", type=Path, default=DEFAULT_LICENSES)
    p.add_argument("--candidate-report", type=Path, default=DEFAULT_CANDIDATE_REPORT)
    p.add_argument("--final-report", type=Path, default=DEFAULT_FINAL_REPORT)
    args = p.parse_args()
    try:
        verify_sources(args.src, list(SOURCES.values()))
        if args.final and args.rebuild:
            raise Stop("--final과 --rebuild는 함께 쓰지 않는다")
        if args.digits_only and not (args.final or args.rebuild):
            raise Stop("--digits-only는 --final이나 --rebuild와 함께 쓴다")
        if args.final or args.rebuild:
            run_final(args)
        else:
            run_candidates(args)
    except Stop as e:
        print(f"멈춤: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
