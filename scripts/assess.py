#!/usr/bin/env python3
"""
发音评测脚本 - 使用 Faster-Whisper
安装依赖: pip install faster-whisper pypinyin
"""

import argparse
import json
import sys
import re
from difflib import SequenceMatcher

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({"error": "请安装 faster-whisper: pip install faster-whisper"}))
    sys.exit(1)

try:
    import pypinyin
except ImportError:
    pypinyin = None

MODEL_SIZE = "medium"
model = None


def get_model():
    global model
    if model is None:
        model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    return model


def transcribe_audio(audio_path, language):
    m = get_model()
    lang_map = {"zh": "zh", "en": "en", "pinyin": "zh"}
    segments, info = m.transcribe(
        audio_path,
        language=lang_map.get(language, "zh"),
        beam_size=5,
    )
    text = ""
    for segment in segments:
        text += segment.text
    return text.strip(), info


def assess_chinese(recognized, expected):
    recognized_clean = re.sub(r"[^\u4e00-\u9fff]", "", recognized)
    expected_clean = re.sub(r"[^\u4e00-\u9fff]", "", expected)
    text_similarity = SequenceMatcher(None, expected_clean, recognized_clean).ratio()

    if pypinyin:
        expected_py = pypinyin.pinyin(expected_clean, style=pypinyin.Style.TONE3)
        recognized_py = pypinyin.pinyin(recognized_clean, style=pypinyin.Style.TONE3)
        expected_py_str = " ".join([p[0] for p in expected_py])
        recognized_py_str = " ".join([p[0] for p in recognized_py])
        pinyin_similarity = SequenceMatcher(None, expected_py_str, recognized_py_str).ratio()
        tone_results = []
        for i, (exp_p, rec_p) in enumerate(zip(expected_py, recognized_py)):
            exp_tone = re.search(r"[1-5]", exp_p[0])
            rec_tone = re.search(r"[1-5]", rec_p[0])
            exp_tone_num = exp_tone.group() if exp_tone else "5"
            rec_tone_num = rec_tone.group() if rec_tone else "5"
            exp_char = expected_clean[i] if i < len(expected_clean) else ""
            rec_char = recognized_clean[i] if i < len(recognized_clean) else ""
            tone_results.append({
                "char": exp_char,
                "expected_pinyin": exp_p[0],
                "recognized_pinyin": rec_p[0] if i < len(recognized_py) else "",
                "recognized_char": rec_char,
                "tone_correct": exp_tone_num == rec_tone_num,
                "char_correct": exp_char == rec_char,
            })
    else:
        pinyin_similarity = text_similarity
        tone_results = []

    overall_score = round((text_similarity * 0.5 + pinyin_similarity * 0.5) * 100, 1)
    return {
        "overall_score": overall_score,
        "accuracy_score": round(text_similarity * 100, 1),
        "pinyin_score": round(pinyin_similarity * 100, 1),
        "details": tone_results,
    }


def assess_english(recognized, expected):
    recognized_clean = re.sub(r"[^\w\s]", "", recognized.lower().strip())
    expected_clean = re.sub(r"[^\w\s]", "", expected.lower().strip())
    overall_similarity = SequenceMatcher(None, expected_clean, recognized_clean).ratio()
    expected_words = expected_clean.split()
    recognized_words = recognized_clean.split()
    word_results = []
    for i, exp_word in enumerate(expected_words):
        if i < len(recognized_words):
            rec_word = recognized_words[i]
            word_sim = SequenceMatcher(None, exp_word, rec_word).ratio()
            word_results.append({
                "expected": exp_word,
                "recognized": rec_word,
                "correct": exp_word == rec_word,
                "score": round(word_sim * 100, 1),
            })
        else:
            word_results.append({
                "expected": exp_word,
                "recognized": "",
                "correct": False,
                "score": 0,
            })
    overall_score = round(overall_similarity * 100, 1)
    return {
        "overall_score": overall_score,
        "accuracy_score": overall_score,
        "details": word_results,
    }


def assess_pinyin(recognized, expected_pinyin):
    recognized_clean = re.sub(r"[^\u4e00-\u9fff]", "", recognized)
    if pypinyin and recognized_clean:
        recognized_py = pypinyin.pinyin(recognized_clean, style=pypinyin.Style.TONE3)
        recognized_py_str = " ".join([p[0] for p in recognized_py])
    else:
        recognized_py_str = recognized.lower()
    expected_clean = expected_pinyin.lower().strip()
    similarity = SequenceMatcher(None, expected_clean, recognized_py_str).ratio()
    expected_syllables = expected_clean.split()
    recognized_syllables = recognized_py_str.split()
    syllable_results = []
    for i, exp_syl in enumerate(expected_syllables):
        if i < len(recognized_syllables):
            rec_syl = recognized_syllables[i]
            exp_initial = re.match(r"[^aeiouü]*", exp_syl).group()
            rec_initial = re.match(r"[^aeiouü]*", rec_syl).group()
            exp_tone = re.search(r"[1-5]", exp_syl)
            rec_tone = re.search(r"[1-5]", rec_syl)
            syl_sim = SequenceMatcher(None, exp_syl, rec_syl).ratio()
            syllable_results.append({
                "expected": exp_syl,
                "recognized": rec_syl,
                "score": round(syl_sim * 100, 1),
                "initial_correct": exp_initial == rec_initial,
                "tone_correct": (
                    (exp_tone and rec_tone and exp_tone.group() == rec_tone.group())
                    or (not exp_tone and not rec_tone)
                ),
            })
        else:
            syllable_results.append({
                "expected": exp_syl,
                "recognized": "",
                "score": 0,
                "initial_correct": False,
                "tone_correct": False,
            })
    overall_score = round(similarity * 100, 1)
    return {
        "overall_score": overall_score,
        "accuracy_score": overall_score,
        "details": syllable_results,
    }


def main():
    parser = argparse.ArgumentParser(description="发音评测")
    parser.add_argument("--audio", required=True, help="音频文件路径")
    parser.add_argument("--text", required=True, help="期望文本")
    parser.add_argument("--language", default="zh", help="语言: zh/en/pinyin")
    args = parser.parse_args()

    try:
        recognized, info = transcribe_audio(args.audio, args.language)
        if args.language == "en":
            assessment = assess_english(recognized, args.text)
        elif args.language == "pinyin":
            assessment = assess_pinyin(recognized, args.text)
        else:
            assessment = assess_chinese(recognized, args.text)

        result = {
            "recognized_text": recognized,
            "expected_text": args.text,
            "language": args.language,
            "assessment": assessment,
        }
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
