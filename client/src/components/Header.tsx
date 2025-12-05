import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Sparkles, Settings, LogOut, Users, Menu, Home, Calendar, X, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { useIsMobile } from "@/hooks/use-mobile";
import { KinmoLogo } from "@/components/KinmoLogo";

// Helper function to get first initial
function getFirstInitial(name: string | null | undefined): string {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

interface HeaderProps {
  testAccounts?: any[];
  onShowTestAccountDialog?: () => void;
}

export function Header({ testAccounts = [], onShowTestAccountDialog }: HeaderProps = {}) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const displayName = user.displayName || user.email || "User";

  return (
    <>
      <header className="border-b border-[#3d3d3d] sticky top-0 z-50" style={{ backgroundColor: '#2D2D2D' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Hamburger Menu (Mobile) + Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                className="h-9 w-9 p-0 text-white/70 hover:text-white hover:bg-white/10"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            )}

            <Link href="/">
              <a className="flex items-center hover:opacity-80 transition-opacity">
                <KinmoLogo size={isMobile ? "sm" : "md"} />
              </a>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <Link href="/?tab=my-events">
              <a className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white/70 hover:text-white hover:bg-white/10">
                Events
              </a>
            </Link>
            <Link href="/?tab=my-groups">
              <a className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white/70 hover:text-white hover:bg-white/10">
                Groups
              </a>
            </Link>
            <Link href="/places">
              <a className="px-4 py-2 rounded-md text-sm font-medium transition-colors text-white/70 hover:text-white hover:bg-white/10">
                Places
              </a>
            </Link>
          </div>

          {/* Spacer for mobile */}
          <div className="flex-1 md:hidden" />

          {/* Right: Notifications + User Profile Menu */}
          <div className="flex items-center gap-1 sm:gap-2">
            <NotificationBell darkMode />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full p-0 hover:bg-white/10"
                data-testid="button-user-menu"
              >
                <Avatar className="h-8 w-8 ring-2 ring-white/20">
                  <AvatarImage
                    src={user.profileImageUrl || undefined}
                    alt={displayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">{getFirstInitial(displayName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-preferences">
              <Link href="/preferences" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-profile">
              <Link href="/profile" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            {user.email === 'raches402@gmail.com' && (
              <>
                <DropdownMenuItem asChild data-testid="menu-admin">
                  <Link href="/admin" className="flex items-center">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                {testAccounts.length > 0 && onShowTestAccountDialog && (
                  <DropdownMenuItem
                    onClick={onShowTestAccountDialog}
                    data-testid="menu-switch-user"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Switch to Test Account
                  </DropdownMenuItem>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => window.location.href = "/api/logout"}
              data-testid="menu-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>

    {/* Mobile Navigation Drawer */}
    <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <div className="flex items-center justify-between">
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="px-4 pb-8 space-y-1">
          {/* Main Navigation Links */}
          <Link href="/">
            <a onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base"
                data-testid="mobile-nav-dashboard"
              >
                <Home className="mr-3 h-5 w-5" />
                Dashboard
              </Button>
            </a>
          </Link>

          <Link href="/?tab=my-events">
            <a onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base"
                data-testid="mobile-nav-member-dashboard"
              >
                <Calendar className="mr-3 h-5 w-5" />
                My Events
              </Button>
            </a>
          </Link>

          <Link href="/places">
            <a onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base"
                data-testid="mobile-nav-places"
              >
                <Heart className="mr-3 h-5 w-5" />
                Places
              </Button>
            </a>
          </Link>

          <Link href="/preferences">
            <a onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base"
                data-testid="mobile-nav-preferences"
              >
                <Settings className="mr-3 h-5 w-5" />
                Preferences
              </Button>
            </a>
          </Link>

          <Link href="/profile">
            <a onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start h-12 text-base"
                data-testid="mobile-nav-profile"
              >
                <Settings className="mr-3 h-5 w-5" />
                Profile Settings
              </Button>
            </a>
          </Link>

          {/* Admin Link (if applicable) */}
          {user.email === 'raches402@gmail.com' && (
            <>
              <div className="my-2 border-t" />
              <Link href="/admin">
                <a onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 text-base"
                    data-testid="mobile-nav-admin"
                  >
                    <Sparkles className="mr-3 h-5 w-5" />
                    Admin Dashboard
                  </Button>
                </a>
              </Link>

              {testAccounts.length > 0 && onShowTestAccountDialog && (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-base"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onShowTestAccountDialog();
                  }}
                  data-testid="mobile-nav-switch-user"
                >
                  <Users className="mr-3 h-5 w-5" />
                  Switch to Test Account
                </Button>
              )}
            </>
          )}

          {/* Sign Out */}
          <div className="my-2 border-t" />
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-base text-destructive hover:text-destructive"
            onClick={() => window.location.href = "/api/logout"}
            data-testid="mobile-nav-logout"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
    </>
  );
}
