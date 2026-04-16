import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const resolveRedirectPath = (value: string | null) => {
  if (!value) return "/";

  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("/") ? decoded : "/";
  } catch {
    return "/";
  }
};

const LoginPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const redirectPath = useMemo(() => resolveRedirectPath(searchParams.get("redirect")), [searchParams]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    navigate(redirectPath, { replace: true });
  }, [isLoading, navigate, redirectPath, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "登录失败，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-10">
      <Card className="w-full rounded-3xl border-border/70">
        <div className="flex items-center gap-3 border-b border-border/70 px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/80">
            <img src="/logo1.png" alt="招投标文件智能审查平台" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">招投标文件智能审查平台</p>
          </div>
        </div>

        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">账号登录</CardTitle>
          <p className="text-sm text-muted-foreground">请使用你的账号登录后访问审查任务。</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
              {isSubmitting ? "登录中..." : "登录"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPageContainer;
