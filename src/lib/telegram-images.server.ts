import topImage from '@/assets/x-progress.jpg?inline';
import graduationImage from '@/assets/x-graduation.jpg?inline';
import introductionImage from '@/assets/x-introduction.jpg?inline';
import coinImage from '@/assets/x-your-coin.jpg?inline';
import profileImage from '@/assets/x-profile.jpg?inline';
import holdingsImage from '@/assets/x-holdings.jpg?inline';
import hederaImage from '@/assets/x-built-on-hedera.jpg?inline';

const appImages = [introductionImage, coinImage, topImage, profileImage, holdingsImage, hederaImage];
export function telegramImage(kind: 'top' | 'graduation' | 'app', index = 0) {
  const image = kind === 'top' ? topImage : kind === 'graduation' ? graduationImage : appImages[index % appImages.length] ?? introductionImage;
  const encoded = image.slice(image.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}