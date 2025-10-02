

import React, { ReactNode, memo, useState, useEffect, useRef } from 'react';
import { Player, Entry, EntryStatus } from './types';

// --- ICONS ---
// A collection of SVG icons used throughout the application.
export const ClockIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" /></svg>
);
export const UsersIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63A13.067 13.067 0 0 1 9.75 21.75a13.067 13.067 0 0 1-5.135-1.872.75.75 0 0 1-.363-.63V19.125ZM15.75 19.125a5.625 5.625 0 0 1 11.25 0v.003l-.001.119a.75.75 0 0 1-.363.63a13.067 13.067 0 0 1-5.135 1.872.75.75 0 0 1-.363-.63V19.125Z" /></svg>
);
export const TrophyIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path fillRule="evenodd" d="M11.25 2.25c.398 0 .75.327.75.75v.168l-1.34 6.703a.75.75 0 0 0 .733.879h3.114a.75.75 0 0 0 .733-.879L13.5 3.168V3a.75.75 0 0 0-.75-.75h-1.5ZM9.955 4.5A1.5 1.5 0 0 0 8.56 5.87L5.015 7.62a1.5 1.5 0 0 0-1.022 1.395l.42 2.103a1.5 1.5 0 0 0 1.022 1.395l3.545 1.752a1.5 1.5 0 0 0 1.44-.002l3.544-1.752a1.5 1.5 0 0 0 1.022-1.395l.42-2.103a1.5 1.5 0 0 0-1.022-1.395l-3.545-1.752a1.5 1.5 0 0 0-1.44-.001Z" clipRule="evenodd" />
        <path d="M12 11.25a.75.75 0 0 1 .75.75v4.547a1.5 1.5 0 0 1-1.5 0v-4.547a.75.75 0 0 1 .75-.75Z" />
        <path fillRule="evenodd" d="M12 21.75c-2.485 0-4.5-2.015-4.5-4.5V15a.75.75 0 0 1 1.5 0v2.25c0 1.657 1.343 3 3 3s3-1.343 3-3V15a.75.75 0 0 1 1.5 0v2.25c0 2.485-2.015 4.5-4.5 4.5Z" clipRule="evenodd" />
    </svg>
);
export const ChipIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" clipRule="evenodd" /></svg>
);
export const PlayIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" /></svg>
);
export const PauseIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" /></svg>
);
export const ForwardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M10.72 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 0 1 0-1.06ZM4.72 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06L11.69 12 4.72 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
);
export const BackwardIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M13.28 3.97a.75.75 0 0 1 0 1.06L6.34 12l6.94 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Zm6 0a.75.75 0 0 1 0 1.06L12.34 12l6.94 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
);
export const CloseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
export const ListBulletIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12ZM3 17.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 17.25Z" clipRule="evenodd" /></svg>
);
export const PencilIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" /><path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" /></svg>
);
export const TrashIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.006a.75.75 0 0 1-.749.654H5.25a.75.75 0 0 1-.749-.654L3.495 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.347-9Zm5.446 0a.75.75 0 1 0-1.5.058l-.347 9a.75.75 0 1 0 1.5-.058l.347-9Z" clipRule="evenodd" /></svg>
);
export const PlusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
);
export const TablesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path fillRule="evenodd" d="M3.75 3.75a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75V4.5a.75.75 0 0 0-.75-.75h-6Zm.75 1.5h4.5v4.5h-4.5V5.25Zm9-1.5a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75V4.5a.75.75 0 0 0-.75-.75h-6Zm.75 1.5h4.5v4.5h-4.5V5.25ZM3.75 12.75a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-.75-.75h-6Zm.75 1.5h4.5v4.5h-4.5v-4.5Zm9-1.5a.75.75 0 0 0-.75.75v6a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-.75-.75h-6Zm.75 1.5h4.5v4.5h-4.5v-4.5Z" clipRule="evenodd" />
    </svg>
);
export const DotsVerticalIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" /></svg>
);
export const LockClosedIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm-3.75 5.25a3.75 3.75 0 1 0 7.5 0v3h-7.5v-3Z" clipRule="evenodd" /></svg>
);
export const LockOpenIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M18 1.5a2.25 2.25 0 0 0-2.25 2.25v3.75A.75.75 0 0 0 16.5 9h.75a.75.75 0 0 0 .75-.75V3.75a3.75 3.75 0 0 1 7.5 0v3a3 3 0 0 1-3 3v6.75a3 3 0 0 1-3 3H8.25a3 3 0 0 1-3-3v-6.75a3 3 0 0 1-3-3v-3a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v3a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5v-3.75A2.25 2.25 0 0 0 18 1.5Z" /></svg>
);
export const ScreenIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path d="M3.75 3h16.5a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V3.75a.75.75 0 0 1 .75-.75ZM5.25 13.5h13.5V4.5H5.25v9Z" />
        <path d="M10.5 16.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.75h3.75a.75.75 0 0 1 0 1.5H7.5a.75.75 0 0 1 0-1.5h3v-.75a.75.75 0 0 1 .75-.75Z" />
    </svg>
);
export const ChartBarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
);
export const CurrencyDollarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
export const BanknotesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101M2.25 7.5a60.07 60.07 0 0 0 15.797 2.101M4.125 6c0-1.036.84-1.875 1.875-1.875h12A1.875 1.875 0 0 1 19.875 6v12a1.875 1.875 0 0 1-1.875 1.875h-12A1.875 1.875 0 0 1 4.125 18V6ZM16.5 9.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5ZM10.5 9.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Z" />
    </svg>
);
export const MegaphoneIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M10.362 1.093a.75.75 0 0 1 0 1.06l-1.72 1.72a.75.75 0 0 1-1.06 0l-1.72-1.72a.75.75 0 1 1 1.06-1.06l1.19 1.19 1.19-1.19a.75.75 0 0 1 1.06 0Z" /><path fillRule="evenodd" d="M6.263 4.646a.75.75 0 0 1 .75-.75h10.022a.75.75 0 0 1 0 1.5H6.263a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /><path d="M10.362 13.093a.75.75 0 0 1 0 1.06l-1.72 1.72a.75.75 0 0 1-1.06 0l-1.72-1.72a.75.75 0 1 1 1.06-1.06l1.19 1.19 1.19-1.19a.75.75 0 0 1 1.06 0Z" /><path fillRule="evenodd" d="M10.45 15.48a.75.75 0 0 0-1.06 1.061l1.65 1.65a.75.75 0 0 0 1.06 0l1.65-1.65a.75.75 0 1 0-1.06-1.061L12 16.19l-.47-.47a.75.75 0 0 0-1.08-.24Z" clipRule="evenodd" /><path fillRule="evenodd" d="M12.75 6.132a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-1.5 0V6.882a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /><path d="M7.138 10.907a.75.75 0 0 1 0 1.06l-2.87 2.87a.75.75 0 0 1-1.06-1.06l2.87-2.87a.75.75 0 0 1 1.06 0Z" /><path d="M17.014 11.967a.75.75 0 0 0-1.06-1.06l-2.87 2.87a.75.75 0 0 0 1.06 1.06l2.87-2.87Z" /><path fillRule="evenodd" d="M1.5 12a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H2.25A.75.75 0 0 1 1.5 12Zm18 0a.75.75 0 0 1 .75-.75h2.25a.75.75 0 0 1 0 1.5H19.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
);
export const UserGroupIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63A13.067 13.067 0 0 1 9.75 21.75a13.067 13.067 0 0 1-5.135-1.872.75.75 0 0 1-.363-.63V19.125ZM15.75 19.125a5.625 5.625 0 0 1 11.25 0v.003l-.001.119a.75.75 0 0 1-.363.63a13.067 13.067 0 0 1-5.135 1.872.75.75 0 0 1-.363-.63V19.125Z" /></svg>
);
export const ClipboardDocumentListIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M10.5 3A2.502 2.502 0 0 0 8 5.5v.075c.312.036.618.094.912.172a.75.75 0 0 1 .638.851c-.053.336-.117.67-.193 1.002a.75.75 0 0 1-.852.639c-.336-.053-.67-.117-1.002-.193a.75.75 0 0 0-.851.638c-.078.293-.136.599-.172.912L6.425 8a.75.75 0 0 0 0 1.5l.075.075c.036.312.094.618.172.912a.75.75 0 0 1-.638.851c-.336.053-.67.117-1.002.193a.75.75 0 0 1-.639-.852c.053-.336.117-.67.193-1.002a.75.75 0 0 0-.852-.639c-.293.078-.599.136-.912.172v.075A2.502 2.502 0 0 0 5.5 14h.075c.036-.312.094-.618.172-.912a.75.75 0 0 1 .851-.638c.336.053.67.117 1.002.193a.75.75 0 0 1 .639.852c-.053.336-.117.67-.193 1.002a.75.75 0 0 0 .852.639c.293-.078.599-.136.912-.172H8A2.502 2.502 0 0 0 10.5 16h3a2.502 2.502 0 0 0 2.5-2.5v-1h1.425c.036.312.094.618.172.912a.75.75 0 0 1-.638.851c-.336.053-.67.117-1.002.193a.75.75 0 0 1-.639-.852c.053-.336.117-.67.193-1.002a.75.75 0 0 0-.852-.639c-.293.078-.599.136-.912-.172h.075A2.502 2.502 0 0 0 16 11.5v-1h.075c.036-.312.094-.618.172-.912a.75.75 0 0 1 .851-.638c.336.053.67.117 1.002.193a.75.75 0 0 1 .639.852c-.053.336-.117.67-.193 1.002a.75.75 0 0 0 .852.639c.293-.078.599-.136.912-.172H20a2.502 2.502 0 0 0-2.5-2.5h-1V6.425c.036-.312.094-.618.172-.912a.75.75 0 0 1 .638-.851c.336-.053.67-.117 1.002-.193a.75.75 0 0 1 .852.639c-.053.336-.117.67-.193 1.002a.75.75 0 0 0 .852.639c.293.078.599.136.912.172V5.5A2.502 2.502 0 0 0 16 3h-5.5Z" clipRule="evenodd" /><path d="M12.5 18a.75.75 0 0 1 -.75.75H8.75a.75.75 0 0 1 0-1.5h3a.75.75 0 0 1 .75.75Z" /></svg>
);
export const ArrowTopRightOnSquareIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M15.75 2.25a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V4.81L8.03 12.53a.75.75 0 0 1-1.06-1.06L14.69 3.75H10.5a.75.75 0 0 1 0-1.5h5.25ZM4.5 4.5a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 1 1.5 0v4.5a4.5 4.5 0 0 1-4.5 4.5H4.5a4.5 4.5 0 0 1-4.5-4.5V7.5a4.5 4.5 0 0 1 4.5-4.5h4.5a.75.75 0 0 1 0 1.5H4.5Z" clipRule="evenodd" /></svg>
);
export const ArrowUturnLeftIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M9.53 2.47a.75.75 0 0 1 0 1.06L4.81 8.25H15a6.75 6.75 0 0 1 0 13.5h-3a.75.75 0 0 1 0-1.5h3a5.25 5.25 0 1 0 0-10.5H4.81l4.72 4.72a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
);
export const IdentificationIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" /></svg>
);
export const SparklesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .75.75l.415 1.66a.75.75 0 0 0 1.06 1.06l1.66.415a.75.75 0 0 1 0 1.5l-1.66.415a.75.75 0 0 0-1.06 1.06l-.415 1.66a.75.75 0 0 1-1.5 0l-.415-1.66a.75.75 0 0 0-1.06-1.06l-1.66-.415a.75.75 0 0 1 0-1.5l1.66-.415a.75.75 0 0 0 1.06-1.06l.415-1.66A.75.75 0 0 1 9 4.5ZM15.75 9.75a.75.75 0 0 1 .75.75l.172.688a.75.75 0 0 0 .802.802l.688.172a.75.75 0 0 1 0 1.5l-.688.172a.75.75 0 0 0-.802.802l-.172.688a.75.75 0 0 1-1.5 0l-.172-.688a.75.75 0 0 0-.802-.802l-.688-.172a.75.75 0 0 1 0-1.5l.688-.172a.75.75 0 0 0 .802-.802l.172-.688a.75.75 0 0 1 .75-.75ZM5.25 15.75a.75.75 0 0 1 .75.75l.172.688a.75.75 0 0 0 .802.802l.688.172a.75.75 0 0 1 0 1.5l-.688.172a.75.75 0 0 0-.802.802l-.172.688a.75.75 0 0 1-1.5 0l-.172-.688a.75.75 0 0 0-.802-.802l-.688-.172a.75.75 0 0 1 0-1.5l.688-.172a.75.75 0 0 0 .802-.802l.172-.688a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>
);
export const CameraIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" /><path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.342 1.372a.75.75 0 0 1-1.06 1.06c-.38-.38-.82-.633-1.282-.692a47.963 47.963 0 0 0-3.312 0c-.462.059-.902.312-1.282.692a.75.75 0 0 1-1.06-1.06c.512-.787 1.375-1.32 2.342-1.372Z" clipRule="evenodd" /></svg>
);
export const ArrowDownTrayIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    <path fillRule="evenodd" d="M3.75 13.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm0 3.75a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75ZM16.5 13.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Zm0 3.75a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
  </svg>
);
export const ArrowUpTrayIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);
export const QrCodeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5A.75.75 0 0 1 4.5 3h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1-.75-.75V4.5Zm0 9.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1-.75-.75v-4.5ZM13.5 4.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75V4.5Zm5.25 3.75v.008h-.008v-.008h.008ZM13.5 14.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm1.5 1.5v-.008h-.008v.008h.008Zm1.5 0a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Zm1.5 1.5v-.008h-.008v.008h.008ZM18 18.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75ZM13.5 18.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75v-.75Z" />
    </svg>
);
export const BarcodeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5v15H3.75v-15Z M5.25 6v12m1.5-12v12m1.5-12v12m1.5-12v12m1.5-12v12M12 6v12m1.5-12v12m1.5-12v12m1.5-12v12" />
    </svg>
);
export const ArrowsRightLeftIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h18m-7.5-14L21 7.5m0 0L16.5 12M21 7.5H3" />
    </svg>
);
export const PrinterIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.061A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.28A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0M3 8.25V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v.75c0 .414-.168.79-.44 1.06a.75.75 0 0 1-1.06 0c-.272-.271-.44-.646-.44-1.06V7.5a.75.75 0 0 0-.75-.75H5.25a.75.75 0 0 0-.75.75v.75c0 .414-.168.79-.44 1.06a.75.75 0 0 1-1.06 0c-.272-.271-.44-.646-.44-1.06Z" />
    </svg>
);
export const ArchiveBoxIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path fillRule="evenodd" d="M2.25 2.25a.75.75 0 0 0-.75.75v11.25a.75.75 0 0 0 .75.75h6.323c.365.23.754.41 1.177.532V21a.75.75 0 0 0 1.5 0v-5.468a4.502 4.502 0 0 1 1.177-.532h6.323a.75.75 0 0 0 .75-.75V3a.75.75 0 0 0-.75-.75H2.25ZM13.5 12a1.5 1.5 0 0 0-1.5 1.5v2.25a.75.75 0 0 0 1.5 0v-2.25a1.5 1.5 0 0 0-1.5-1.5ZM12 7.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 7.5ZM10.03 8.47a.75.75 0 0 0-1.06 0l-1.5 1.5a.75.75 0 0 0 1.06 1.06l1.5-1.5a.75.75 0 0 0 0-1.06ZM15.03 8.47a.75.75 0 0 0 0 1.06l1.5 1.5a.75.75 0 0 0 1.06-1.06l-1.5-1.5a.75.75 0 0 0-1.06 0Z" clipRule="evenodd" />
        <path d="M3.75 16.5a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h16.5a.75.75 0 0 0 .75-.75v-.008a.75.75 0 0 0-.75-.75H3.75Z" />
    </svg>
);
export const EyeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a.75.75 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
    </svg>
);
export const EyeSlashIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}>
        <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
        <path d="M15.75 12c0 .18-.013.357-.037.53l-2.24 2.24c.173.024.35.037.53.037a3 3 0 1 0 0-6A3 3 0 0 0 12 9c-.18 0-.357.013-.53.037L9.24 6.76A5.25 5.25 0 0 1 15.75 12Z" />
        <path d="M12.001 3.75c-2.396 0-4.644.946-6.337 2.622l2.103 2.102a5.25 5.25 0 0 0 7.424 7.424l2.103 2.102c1.676-1.693 2.622-3.94 2.622-6.337 0-4.97-4.215-7.697-10.677-7.697Z" />
    </svg>
);
export const WifiIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69a.75.75 0 0 1 0 1.113-20.94 20.94 0 0 1-10.675 7.697C7.028 20.25 2.811 17.024 1.323 12.553a.75.75 0 0 1 0-1.113ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" /><path d="M15.93 12a3.93 3.93 0 1 1-7.86 0 3.93 3.93 0 0 1 7.86 0Z" /></svg>
);
export const NoSymbolIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
);
export const ArrowPathIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-6 h-6"}><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm.53 5.47a.75.75 0 0 0-1.06 0l-3 3a.75.75 0 1 0 1.06 1.06l1.72-1.72v5.69a.75.75 0 0 0 1.5 0v-5.69l1.72 1.72a.75.75 0 1 0 1.06-1.06l-3-3Z" clipRule="evenodd" /></svg>
);


// --- LAYOUT ---
export const Card = ({ children, className, ...props }: { children: ReactNode, className?: string, [key: string]: any }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 shadow-lg ${className || ''}`} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ children, className }: { children: ReactNode, className?: string }) => (
  <h2 className={`text-xl font-bold text-white mb-4 ${className || ''}`}>
    {children}
  </h2>
);

// --- FORM & BUTTONS ---
type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export const Button = ({ children, onClick, className, variant = 'primary', size = 'md', type = 'button', disabled = false, title, isLoading = false }: { children: ReactNode, onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void, className?: string, variant?: ButtonVariant, size?: ButtonSize, type?: 'button' | 'submit' | 'reset', disabled?: boolean, title?: string, isLoading?: boolean }) => {
    const baseClasses = "font-bold rounded-lg shadow-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";
    const variantClasses = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        secondary: "bg-gray-600 hover:bg-gray-500 text-gray-100 focus:ring-gray-400",
        danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    };
    const sizeClasses = {
        sm: "py-1 px-2 text-xs",
        md: "py-2 px-4 text-sm",
        lg: "py-3 px-6 text-base",
    };

    const finalDisabled = disabled || isLoading;

    return (
        <button type={type} onClick={onClick} className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''} transition-transform transform hover:scale-105`} disabled={finalDisabled} title={title}>
            {isLoading ? <span className="spinner"></span> : children}
        </button>
    );
};


// --- UI ELEMENTS ---
export const StatCard = ({ label, value, icon }: { label: string, value: string | number, icon: ReactNode }) => {
    return (
        <Card className="flex items-center space-x-4">
            <div className="bg-blue-600/20 p-3 rounded-full text-blue-400">{icon}</div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
            </div>
        </Card>
    );
};

export const TabButton = ({ label, icon, isActive, onClick }: { label: string, icon: ReactNode, isActive: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'}`}>
        {icon}
        {label}
    </button>
);

export const Modal = ({ isOpen, onClose, children, maxWidth = '2xl' }: { isOpen: boolean, onClose: () => void, children: ReactNode, maxWidth?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            // Delay for mount transition
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;
    
    const maxWidthClasses: {[key:string]: string} = {
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div 
                className={`bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-full ${maxWidthClasses[maxWidth] || 'max-w-2xl'} transform transition-all duration-300 ease-out ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const ScrollingTicker = ({ items, speed = 'normal' }: { items: string[], speed?: 'slow' | 'normal' | 'fast' }) => {
    const durationClasses = {
        slow: '80s',
        normal: '40s',
        fast: '20s',
    };
    const animationDuration = durationClasses[speed] || '40s';
    if (!items || items.length === 0) return null;

    const tickerContent = items.join(' • ');

    return (
        <div className="bg-black/30 w-full overflow-hidden whitespace-nowrap py-2 px-4 rounded-md border border-gray-700">
            <div 
                className="inline-block ticker-animation" 
                style={{ '--ticker-duration': animationDuration } as React.CSSProperties}
            >
                <span className="text-gray-300 font-semibold pr-16">{tickerContent}</span>
                <span className="text-gray-300 font-semibold pr-16">{tickerContent}</span>
            </div>
        </div>
    );
};