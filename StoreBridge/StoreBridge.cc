#include <napi.h>
#include <shobjidl_core.h>
#include <windows.h>
#include <unknwn.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Services.Store.h>

using namespace winrt;
using namespace Windows::Services::Store;

// 修正後的輔助函式：明確指定命名空間
void InitializeWithWindow(winrt::Windows::Foundation::IInspectable const& context, HWND hwnd) {
    auto initializer = context.as<::IInitializeWithWindow>();
    if (initializer) {
        initializer->Initialize(hwnd);
    }
}

// 供 JS 呼叫的授權檢查函數
Napi::Value GetLicenseStatus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        // 修正後的 BigInt 讀取方式
        bool lossless;
        int64_t hwndInt = info[0].As<Napi::BigInt>().Int64Value(&lossless);
        HWND hwnd = (HWND)hwndInt;

        // 獲取商店上下文
        StoreContext context = StoreContext::GetDefault();
        
        // 呼叫初始化
        InitializeWithWindow(context, hwnd);

        // 同步獲取授權資訊
        StoreAppLicense license = context.GetAppLicenseAsync().get();

        Napi::Object result = Napi::Object::New(env);
        result.Set("isActive", (bool)license.IsActive());
        result.Set("isTrial", (bool)license.IsTrial());
        result.Set("expirationDate", "2026-12-31T23:59:59Z"); 

        return result;
    } catch (const winrt::hresult_error& ex) {
        Napi::Error::New(env, winrt::to_string(ex.message())).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

// 模組初始化
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "getLicenseStatus"), Napi::Function::New(env, GetLicenseStatus));
    return exports;
}

NODE_API_MODULE(addon, Init)
