'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Logout } from './logout';
import { en } from '@/i18n/en';

export function StudentNavigation({
  name,
  fullCourse,
}: {
  name: string;
  fullCourse: boolean;
}) {
  const pathname = usePathname();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const desktop = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/dashboard', label: en.dashboard },
    { href: '/course/software-engineer', label: en.courseLabel },
    { href: '/course/software-engineer/progress', label: en.learning.progress },
    ...(fullCourse
      ? [
          { href: '/resources', label: en.curriculum.references },
          { href: '/search', label: 'Search' },
        ]
      : []),
    { href: '/settings', label: 'Settings' },
  ];
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const resize = () => {
      if (media.matches) dialog.current?.close();
    };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const iconMap: Record<string, string> = {
    '/dashboard': '⚡',
    '/course/software-engineer': '📚',
    '/course/software-engineer/progress': '📈',
    '/resources': '📖',
    '/search': '🔍',
    '/settings': '⚙️',
  };

  const destinations = () =>
    links.map(({ href, label }) => (
      <Link
        key={href}
        href={href}
        prefetch={false}
        aria-current={pathname === href ? 'page' : undefined}
        className={`sidebar-nav-link ${pathname === href ? 'active' : ''}`}
      >
        <span className="nav-icon" aria-hidden="true">
          {iconMap[href] ?? '•'}
        </span>
        <span className="nav-label">{label}</span>
      </Link>
    ));
  return (
    <>
      <nav
        className="student-desktop-nav"
        aria-label="Student"
        ref={desktop}
      >
        <div className="sidebar-brand">
          <span className="sidebar-logo" aria-hidden="true">
            🌿
          </span>
          <div>
            <div className="sidebar-title">LearningHub</div>
            <div className="sidebar-subtitle">Software Engineer</div>
          </div>
        </div>
        <div className="sidebar-section-label">Glavni meni</div>
        <div className="sidebar-links-list">{destinations()}</div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" aria-hidden="true">
              {name ? name.slice(0, 2).toUpperCase() : 'ST'}
            </div>
            <div className="sidebar-user-info">
              <span className="student-name">{name}</span>
              <span className="sidebar-status">● Lokalna baza</span>
            </div>
          </div>
          <Logout />
        </div>
      </nav>
      <header className="student-mobile-header mb-8">
        <button
          ref={trigger}
          type="button"
          className="button"
          aria-haspopup="dialog"
          aria-controls={id}
          aria-expanded={open}
          onClick={() => {
            if (dialog.current && !dialog.current.open) {
              dialog.current.showModal();
              setOpen(true);
            }
          }}
        >
          {en.mobile.menu}
        </button>
        <span className="muted student-name">{name}</span>
      </header>
      <dialog
        ref={dialog}
        id={id}
        className="mobile-drawer"
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not(:disabled)',
            ),
          ).filter((element) => element.tabIndex >= 0 && !element.hidden);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          dialog.current?.close();
        }}
        onClose={() => {
          setOpen(false);
          if (window.matchMedia('(min-width: 1024px)').matches)
            desktop.current?.querySelector('a')?.focus();
          else trigger.current?.focus();
        }}
      >
        <div className="drawer-heading">
          <h2 id={`${id}-title`}>{en.mobile.title}</h2>
          <button
            type="button"
            className="button"
            onClick={() => dialog.current?.close()}
          >
            {en.mobile.close}
          </button>
        </div>
        <nav
          aria-label={en.mobile.title}
          className="drawer-links"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a'))
              dialog.current?.close();
          }}
        >
          {destinations()}
        </nav>
        {fullCourse && (
          <Link
            prefetch={false}
            className="button drawer-outline"
            href="/course/software-engineer#course-outline"
            onClick={(event) => {
              const outline = document.getElementById('course-outline');
              dialog.current?.close();
              if (outline) {
                event.preventDefault();
                const group = outline.querySelector('details');
                if (group) group.open = true;
                // Close event restores trigger focus first; then move to the requested outline.
                requestAnimationFrame(() =>
                  outline.querySelector('summary')?.focus(),
                );
              }
            }}
          >
            {en.navigation.outline}
          </Link>
        )}
        <div className="section">
          <Logout />
        </div>
      </dialog>
    </>
  );
}
