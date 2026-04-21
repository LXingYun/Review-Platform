import { useMemo, useState } from "react";
import {
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useResetAdminUserPasswordMutation,
  useUpdateAdminUserMutation,
} from "@/hooks/queries";
import { useAuth } from "@/context/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const UserManagementPageContainer = () => {
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading, isError, error } = useAdminUsersQuery();
  const createUserMutation = useCreateAdminUserMutation();
  const updateUserMutation = useUpdateAdminUserMutation();
  const resetPasswordMutation = useResetAdminUserPasswordMutation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () => users.slice().sort((left, right) => left.username.localeCompare(right.username)),
    [users],
  );

  const createUser = async () => {
    setMessage(null);
    try {
      await createUserMutation.mutateAsync({ username, password, role });
      setUsername("");
      setPassword("");
      setRole("user");
      setMessage("用户已创建。");
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : "创建用户失败。");
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    setMessage(null);
    try {
      await updateUserMutation.mutateAsync({ userId, isActive: !isActive });
      setMessage("用户状态已更新。");
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : "更新用户状态失败。");
    }
  };

  const switchUserRole = async (userId: string, currentRole: "admin" | "user") => {
    setMessage(null);
    try {
      await updateUserMutation.mutateAsync({
        userId,
        role: currentRole === "admin" ? "user" : "admin",
      });
      setMessage("用户角色已更新。");
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : "更新用户角色失败。");
    }
  };

  const resetPassword = async (userId: string) => {
    const nextPassword = resetPasswords[userId]?.trim() ?? "";
    if (!nextPassword) {
      setMessage("重置密码不能为空。");
      return;
    }

    setMessage(null);
    try {
      await resetPasswordMutation.mutateAsync({ userId, password: nextPassword });
      setResetPasswords((current) => ({ ...current, [userId]: "" }));
      setMessage("密码已重置。");
    } catch (resetError) {
      setMessage(resetError instanceof Error ? resetError.message : "重置密码失败。");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <Card className="rounded-3xl border-border/70">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">创建用户</CardTitle>
          <p className="text-sm text-muted-foreground">新建管理员或普通账号。</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_140px_120px]">
          <Input
            placeholder="用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Input
            placeholder="密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "user")}
          >
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <Button onClick={createUser} disabled={createUserMutation.isPending}>
            创建
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/70">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">用户列表</CardTitle>
          <p className="text-sm text-muted-foreground">管理用户角色、启用状态和密码重置。</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">用户加载中...</p> : null}
          {isError ? (
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "加载用户失败。"}</p>
          ) : null}
          {message ? <p className="text-sm text-primary">{message}</p> : null}

          {sortedUsers.map((item) => {
            const isSelf = currentUser?.id === item.id;
            return (
              <div
                key={item.id}
                className="grid gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 md:grid-cols-[180px_90px_120px_1fr_120px]"
              >
                <div>
                  <p className="text-sm font-medium">{item.username}</p>
                  <p className="text-xs text-muted-foreground">{item.isActive ? "启用中" : "已禁用"}</p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => switchUserRole(item.id, item.role)}
                  disabled={updateUserMutation.isPending}
                >
                  {item.role === "admin" ? "管理员" : "普通用户"}
                </Button>

                <Button
                  variant={item.isActive ? "secondary" : "outline"}
                  onClick={() => toggleUserStatus(item.id, item.isActive)}
                  disabled={updateUserMutation.isPending || isSelf}
                >
                  {item.isActive ? "禁用" : "启用"}
                </Button>

                <Input
                  type="password"
                  placeholder="新密码"
                  value={resetPasswords[item.id] ?? ""}
                  onChange={(event) =>
                    setResetPasswords((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />

                <Button
                  variant="outline"
                  onClick={() => resetPassword(item.id)}
                  disabled={resetPasswordMutation.isPending}
                >
                  重置
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagementPageContainer;
