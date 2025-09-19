'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import { removeCookie } from '@/lib/utils.cookies';

// icons
import { Sun, Moon, Monitor, LogOut, Check } from 'lucide-react';

// types
import { GetSessionResponse } from '@/types/api/response';

// hooks
import { useTypedQuery } from '@/hooks';

// components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface Props {
  token?: string;
}

export const HeaderUserProfile: React.FC<Props> = ({ token }) => {
  const router = useRouter();

  const { data: sessionData, isLoading } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const handleLogout = () => {
    removeCookie('token');
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isLoading}>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {sessionData?.data?.user && sessionData?.data?.user.image && (
              <AvatarImage
                src={sessionData?.data?.user && sessionData?.data?.user.image}
                alt="User avatar"
              />
            )}
            <AvatarFallback>
              {isLoading
                ? 'W.'
                : ((sessionData?.data?.user && sessionData?.data?.user.name) || 'W.')
                    .charAt(0)
                    .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="mt-2 w-48" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="line-clamp-1 text-sm leading-none font-medium">
              {(sessionData?.data?.user && sessionData?.data?.user.name) || 'na'}
            </p>
            <p className="text-muted-foreground line-clamp-1 text-sm leading-none">
              {(sessionData?.data?.user && sessionData?.data?.user.email) || 'na'}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;

            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{option.label}</span>
                {isSelected && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
