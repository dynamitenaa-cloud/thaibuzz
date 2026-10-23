import { SITE } from './site';

// 실명 편집자 (E-E-A-T). 사이트 전체 글의 작성자(Person)로 표기되고 /author/<slug>/ 프로필 페이지를 가짐
export const EDITOR = {
  slug: 'youn-min-shin',
  name: 'ชิน ยุน-มิน', // 태국어 표기 (사이트 관례: 성 먼저, 예 "คิม จอง-อึน")
  nameEn: 'Youn-min Shin',
  nameKo: '신윤민',
  jobTitle: 'บรรณาธิการ',
  job2: 'เชฟ', // 본업
  photo: '/author/editor.webp', // 640x640
  photoJpg: '/author/editor.jpg',
  hometown: 'อันซอง จังหวัดคยองกี ประเทศเกาหลีใต้',
  yearsInThailand: 4,
  // 프로필 페이지 본문 (태국어). 첫 문단은 글 하단 바이라인 설명에도 쓰임
  bio: [
    'บรรณาธิการชาวเกาหลีจากเมืองอันซอง จังหวัดคยองกี ใช้ชีวิตอยู่ในประเทศไทยมา 4 ปี ทำงานเป็นเชฟในประเทศไทย และดูแล ThaiBuzz นอกเวลางาน พูดและอ่านภาษาเกาหลีเป็นภาษาแม่ จึงติดตามข่าวบันเทิงเกาหลีจากสื่อต้นทางได้โดยตรง ไม่ต้องรอการแปลผ่านภาษาอังกฤษ',
    'ก่อตั้ง ThaiBuzz เพราะเห็นว่าข่าว K-pop และซีรีส์เกาหลีที่ไปถึงคนไทยมักช้าไปหนึ่งวันและขาดบริบทที่คนเกาหลีรู้กันอยู่แล้ว เช่น ศิลปินคนนี้ดังในเกาหลีเพราะอะไร หรือข่าวนี้คนเกาหลีมองอย่างไร',
    'ในบทความที่มีกล่อง "มุมมองจากบรรณาธิการชาวเกาหลี" ข้อความในกล่องนั้นเขียนเองทุกคำ ส่วนเนื้อข่าวเรียบเรียงด้วยความช่วยเหลือของ AI จากแหล่งข่าวที่ระบุไว้ท้ายบทความ และตรวจทานตามนโยบายกองบรรณาธิการ',
  ],
  // 개인 SNS (있으면 추가). 비어 있으면 페이지 공식 계정만 sameAs 에 들어감
  sameAs: ['https://www.instagram.com/younminshin/'] as string[],
} as const;

export const editorUrl = () => `/author/${EDITOR.slug}/`;
export const editorId = () => `${SITE.url}${editorUrl()}#person`;

// 사이트 공통 @graph 에 들어가는 Person 노드
export const editorPerson = () => ({
  '@type': 'Person',
  '@id': editorId(),
  name: EDITOR.name,
  alternateName: [EDITOR.nameEn, EDITOR.nameKo].filter(Boolean),
  url: `${SITE.url}${editorUrl()}`,
  image: `${SITE.url}${EDITOR.photoJpg}`,
  jobTitle: EDITOR.jobTitle,
  nationality: { '@type': 'Country', name: 'South Korea' },
  homeLocation: { '@type': 'Place', name: 'Thailand' },
  hasOccupation: [{ '@type': 'Occupation', name: 'Editor' }, { '@type': 'Occupation', name: 'Chef' }],
  worksFor: { '@id': `${SITE.url}/#org` },
  description: EDITOR.bio[0],
  sameAs: [...EDITOR.sameAs, ...Object.values(SITE.social).filter(Boolean)],
});
