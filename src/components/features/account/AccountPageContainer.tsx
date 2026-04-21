import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";

const minPasswordLength = 10;
const maxPasswordLength = 128;

const AccountPageContainer = () => {
  const { toast } = useToast();
  const { user, changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordLengthValid =
    newPassword.length >= minPasswordLength && newPassword.length <= maxPasswordLength;
  const isPasswordConfirmed = newPassword === confirmPassword;
  const validationMessage =
    !newPassword || isPasswordLengthValid
      ? !confirmPassword || isPasswordConfirmed
        ? null
        : "两次输入的新密码不一致。"
      : `新密码长度需为 ${minPasswordLength}-${maxPasswordLength} 个字符。`;
  const canSubmit =
    Boolean(oldPassword) &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    isPasswordLengthValid &&
    isPasswordConfirmed &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await changePassword({
        oldPassword,
        newPassword,
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "密码已更新",
        description: "当前会话保留，其他已登录会话会失效。",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "修改密码失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <p className="text-sm text-muted-foreground">账号信息加载中...</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="surface-paper rounded-[34px] px-6 py-8 md:px-8 md:py-9">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border/80 bg-background/80 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">账号设置</h1>
            <p className="mt-1 text-muted-foreground">管理当前账号信息，并修改登录密码。</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="surface-panel border-border/80 bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">当前账号</CardTitle>
            <CardDescription>这里显示当前登录用户的基本信息。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-[20px] border border-border/80 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">用户名</p>
              <p className="mt-2 text-base font-medium text-foreground">{user.username}</p>
            </div>
            <div className="rounded-[20px] border border-border/80 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">角色</p>
              <p className="mt-2 text-base font-medium capitalize text-foreground">{user.role}</p>
            </div>
            <div className="rounded-[20px] border border-border/80 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">最近登录</p>
              <p className="mt-2 text-base font-medium text-foreground">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "暂无记录"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/80 bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">修改密码</CardTitle>
            <CardDescription>修改后，当前会话保留，其他已登录设备需要重新登录。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="old-password">当前密码</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">新密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  密码长度需为 {minPasswordLength}-{maxPasswordLength} 个字符。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">确认新密码</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {validationMessage ? <p className="text-sm text-destructive">{validationMessage}</p> : null}
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {isSubmitting ? "更新中..." : "更新密码"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountPageContainer;
