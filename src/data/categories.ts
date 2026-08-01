import type { Category } from '../types'

export const categories: Category[] = [
  { id: 'hidden', title: '숨은그림', subtitle: '장면 속 단서를 찾아라', icon: '🔎', accent: '#4fd1c5' },
  { id: 'memory', title: '말씀암송', subtitle: '말씀을 정확히 기억해요', icon: '📖', accent: '#60a5fa' },
  { id: 'ox', title: 'OX', subtitle: '맞으면 O, 틀리면 X', icon: '⭕', accent: '#f472b6' },
  { id: 'sermon', title: '지난 설교', subtitle: '설교 내용을 떠올려요', icon: '🎙️', accent: '#a78bfa' },
  { id: 'surprise', title: '돌발퀴즈', subtitle: '예측 불가 번개 문제', icon: '⚡', accent: '#fbbf24' },
  { id: 'joseph', title: '요셉스토리', subtitle: '요셉과 형제들의 이야기', icon: '🌾', accent: '#fb923c' },
  { id: 'character', title: '인물퀴즈', subtitle: '성경 인물을 맞혀요', icon: '👤', accent: '#34d399' },
  { id: 'initial', title: '초성퀴즈', subtitle: '초성으로 정답 찾기', icon: 'ㄱ', accent: '#38bdf8' },
  { id: 'bible', title: '성경상식', subtitle: '알쏭달쏭 성경 지식', icon: '💡', accent: '#f87171' },
  { id: 'teacher', title: '선생님퀴즈', subtitle: '선생님을 얼마나 알까?', icon: '🎓', accent: '#c084fc' },
]
