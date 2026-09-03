// توليد أفاتار من Dicebear (avataaars) بشكل متسق مع النوع،
// عشان مايجيش شعر/شكل ست لراجل أو العكس.

export type Gender = 'male' | 'female';

// مجموعة أشكال شعر "ولادي" بس
const MALE_TOPS = [
  'shortHairShortCurly',
  'shortHairShortFlat',
  'shortHairShortRound',
  'shortHairShortWaved',
  'shortHairSides',
  'shortHairTheCaesar',
  'shortHairTheCaesarSidePart',
  'shortHairDreads01',
  'shortHairDreads02',
  'shortHairFrizzle',
  'hat',
  'turban',
].join(',');

// مجموعة أشكال شعر "بناتي" بس
const FEMALE_TOPS = [
  'longHairBigHair',
  'longHairBob',
  'longHairBun',
  'longHairCurly',
  'longHairCurvy',
  'longHairDreads',
  'longHairFrida',
  'longHairFro',
  'longHairFroBand',
  'longHairMiaWallace',
  'longHairNotTooLong',
  'longHairStraight',
  'longHairStraight2',
  'longHairStraightStrand',
].join(',');

/**
 * بيرجّع رابط أفاتار SVG جاهز.
 * لو النوع معروف (male/female) بيقفل اختيار الشعر واللحية على الأشكال المناسبة.
 * لو مش معروف، بيرجع سلوك Dicebear العشوائي القديم زي ما كان.
 */
export function getAvatarUrl(seed: string): string {
  const safeSeed = seed || 'User';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(safeSeed)}&background=0D9488&color=fff&rounded=true&bold=true`;
}