import type { PageView } from './Header';

interface FooterProps {
  onNavigate: (page: PageView) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-[var(--color-footer)] text-[#FAF6EC] border-t border-[var(--color-border)] mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          <div className="md:col-span-2">
            <p className="font-display text-xl font-extrabold text-white">سوق الغنم</p>
            <p className="mt-3 text-sm text-[#FAF6EC]/80 max-w-md leading-relaxed">
              منصة سعودية متخصصة لإعلانات المواشي، تجمع المربين والبائعين والمشترين في بيئة منظمة وواضحة بالأسعار الاسترشادية والمواصفات الدقيقة.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--color-gold)] mb-3">أقسام المنصة</p>
            <ul className="space-y-2 text-sm text-[#FAF6EC]/85">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('listings')}
                  className="hover:text-white cursor-pointer"
                >
                  جميع الإعلانات
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('breeds')}
                  className="hover:text-white cursor-pointer"
                >
                  دليل السلالات
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('breeders')}
                  className="hover:text-white cursor-pointer"
                >
                  المربون والأسعار الاسترشادية
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('add')}
                  className="hover:text-white cursor-pointer"
                >
                  أضف إعلانك
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--color-gold)] mb-3">الحساب والإدارة</p>
            <ul className="space-y-2 text-sm text-[#FAF6EC]/85">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="hover:text-white cursor-pointer"
                >
                  لوحة البائع والمحادثات
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="hover:text-white cursor-pointer"
                >
                  المفضلة
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="hover:text-white cursor-pointer"
                >
                  لوحة الإشراف والمراجعة
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FAF6EC]/70">
          <p>© 2026 سوق الغنم — المملكة العربية السعودية. جميع الأسعار بالريال السعودي.</p>
          <p>منصة إعلانات مواشٍ متخصصة — النعيمي · النجدي · الحري · العارضي</p>
        </div>
      </div>
    </footer>
  );
}
